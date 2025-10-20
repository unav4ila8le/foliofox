# Transactional Portfolio Records + Snapshots Recalculation (Design Notes)

## Goal

Make create/update/delete of portfolio records atomic with snapshots recalculation so the system never persists a record change without the corresponding snapshot timeline update.

## Constraints

- No external network calls inside a DB transaction.
- Use only cached market data tables (`quotes`, `domain_valuations`) during recalculation.
- Preserve recalculation semantics already implemented in TypeScript:
  - Recalc from a start date until (exclusive) the next `UPDATE` record.
  - Apply records ordered by `(date asc, created_at asc)`.
  - `UPDATE` resets `quantity` and `cost_basis_per_unit` on its day.
  - Snapshot unit value is market-as-of date if available, otherwise fall back to record `unit_value` or last running cost-basis.

## Approach A — Postgres Function (Preferred)

Implement a single SQL function that performs the CRUD and full recalculation in one transaction.

### Function shape (example)

```sql
-- SECURITY DEFINER to bypass RLS internally, but enforce ownership in-function
create or replace function public.upsert_portfolio_record_and_recalc(
  p_user_id uuid,
  p_action text,                                 -- 'create' | 'update' | 'delete'
  p_record_id uuid default null,                 -- for update/delete
  p_position_id uuid default null,               -- for create
  p_type text default null,                      -- 'buy' | 'sell' | 'update' (create/update)
  p_date date default null,
  p_quantity numeric default null,
  p_unit_value numeric default null,
  p_description text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_position_id uuid;
  v_from_date date;
  v_next_update date;
  v_locked boolean;
  v_result jsonb := '{"success": false}'::jsonb;
begin
  -- Ownership check: ensure user owns position/record
  if p_action in ('update','delete') then
    select position_id into v_position_id
    from portfolio_records
    where id = p_record_id
      and user_id = p_user_id;
    if v_position_id is null then
      return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
    end if;
  else
    v_position_id := p_position_id;
    if not exists (
      select 1 from positions where id = v_position_id and user_id = p_user_id
    ) then
      return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
    end if;
  end if;

  -- Per-position transactional lock to serialize recalcs
  v_locked := pg_try_advisory_xact_lock(hashtext(v_position_id::text));
  if not v_locked then
    return jsonb_build_object('success', false, 'code', 'LOCK_NOT_ACQUIRED');
  end if;

  -- Perform action
  if p_action = 'create' then
    insert into portfolio_records(user_id, position_id, type, date, quantity, unit_value, description)
    values (p_user_id, v_position_id, p_type, p_date, p_quantity, p_unit_value, p_description);
    v_from_date := p_date;
  elsif p_action = 'update' then
    -- capture earliest affected date (old vs new)
    with old as (
      select date from portfolio_records where id = p_record_id and user_id = p_user_id
    )
    update portfolio_records
      set type = p_type,
          date = p_date,
          quantity = p_quantity,
          unit_value = p_unit_value,
          description = p_description
    where id = p_record_id and user_id = p_user_id;
    select least((select date from old), p_date) into v_from_date;
  elsif p_action = 'delete' then
    select date into v_from_date from portfolio_records where id = p_record_id and user_id = p_user_id;
    delete from portfolio_records where id = p_record_id and user_id = p_user_id;
  else
    return jsonb_build_object('success', false, 'code', 'BAD_ACTION');
  end if;

  -- Compute next UPDATE boundary
  select date into v_next_update
  from portfolio_records
  where position_id = v_position_id and user_id = p_user_id and type = 'update' and date > v_from_date
  order by date asc
  limit 1;

  -- Delete snapshots in the affected window (>= from_date and < next_update)
  delete from position_snapshots
  where position_id = v_position_id
    and user_id = p_user_id
    and date >= v_from_date
    and (v_next_update is null or date < v_next_update);

  -- Rebuild snapshots by replaying records in window (excluding UPDATEs)
  -- NOTE: Pricing uses cached tables only (quotes, domain_valuations).
  --       For keys, use symbol_id/domain_id via position_sources_flat.
  with src as (
    select p.id as position_id,
           psf.symbol_id,
           psf.domain_id,
           p.currency
    from positions p
    left join position_sources_flat psf on psf.id = p.source_id
    where p.id = v_position_id and p.user_id = p_user_id
  ),
  base as (
    select quantity, cost_basis_per_unit, date, created_at
    from position_snapshots
    where position_id = v_position_id and user_id = p_user_id and date <= v_from_date
    order by date desc, created_at desc
    limit 1
  ),
  records as (
    select id, type, quantity, unit_value, date, created_at
    from portfolio_records
    where position_id = v_position_id and user_id = p_user_id
      and date > coalesce((select date from base), '1900-01-01'::date)
      and (v_next_update is null or date < v_next_update)
    order by date asc, created_at asc
  )
  -- Materialize replay in plpgsql (simpler to keep here for clarity)
  select 1 into v_locked; -- no-op anchor

  -- The following loop emulates the TS logic:
  -- runningQuantity, runningCostBasis updated by BUY/SELL/UPDATE;
  -- per-record day: choose snapshot unit_value via market tables else fallback.
  perform 1;

  -- NOTE: For production, implement the replay with a plpgsql loop that:
  -- 1) Initializes running values from base
  -- 2) Iterates over affected days; for each day applies intra-day records in order
  -- 3) For each day, resolves unit_value via:
  --    - if src.symbol_id then select price from quotes where (symbol_id, date)
  --    - else if src.domain_id then select price from domain_valuations where (id, date)
  --    - else fallback to record.unit_value or running cost basis
  -- 4) Inserts snapshot rows

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'code', 'EXCEPTION', 'message', sqlerrm);
end; $$;
```

### Notes

- The function uses an advisory transaction lock keyed by `position_id` to serialize concurrent recalculations.
- No external HTTP calls are performed; pricing reads cached tables only.
- Mark as `SECURITY DEFINER`; perform explicit ownership checks using `p_user_id`.
- Implement the replay loop in PL/pgSQL to mirror the current TypeScript rules. Keep ordering by `(date, created_at)`.

## Approach B — App-Managed Transaction (Intermediate)

If moving logic into SQL is deferred, use compensation or a job with best-effort consistency:

- Insert/update/delete the record in the DB.
- In the same request, enqueue a recalculation job (idempotent per `(position_id, from_date)`), and surface a warning if it fails.
- Optionally compensate on failure (delete/revert the record) to keep state consistent.

## Migration Plan (Later)

1. Implement the SQL function and replay loop using cached market data.
2. Replace current server actions to call the function via RPC with the user’s `auth.uid()`.
3. Remove TypeScript recalculation path or keep as fallback.
4. Add tests for create/update/delete across edge cases (same-day ordering, UPDATE boundaries, empty pricing, archived positions).

## Testing Checklist

- CRUD returns success atomically; snapshots reflect the change immediately.
- UPDATE on a day resets quantity/cost basis before snapshot pricing.
- Same-day multiple records ordered by `created_at`.
- Pricing keys resolve correctly for symbols/domains; customs fall back safely.
- Concurrent updates on the same position are serialized by the advisory lock.
