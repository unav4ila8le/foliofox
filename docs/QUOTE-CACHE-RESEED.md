# Quote Cache Reseed Runbook

This runbook covers how to safely reset and repopulate `public.quotes` when cache data is stale, drifted, or intentionally purged.

It is intentionally implementation-light so it remains useful as the codebase evolves.

## When to use this

- Quote cache has known drift versus provider data.
- Quote schema changed and old rows are no longer trusted.
- You intentionally purged `public.quotes` and need controlled refill.

## Pre-checks

1. Latest quote-related migration is applied in the target environment.
2. `CRON_SECRET` is configured in deployment.
3. You can call:
   - `GET /api/cron/fetch-quotes`
4. Optional: enable maintenance mode if you want zero user traffic during reseed.

## Recommended strategy

Use a two-stage refill:

1. **Seed latest data first** (single cron call).
2. **Backfill history only if needed** (date-override loop).

This avoids unnecessary provider traffic and keeps operational risk low.

## Procedure

### 1) Optional maintenance window

If your deployment supports maintenance mode, enable it before purge/reseed and disable it after validation.

### 2) Optional prune of unlinked symbols

If you maintain symbols that are no longer linked to any position, pruning them before reseed reduces provider calls.

Only do this if symbol cleanup is already an accepted operational policy in your project.

### 3) Purge quotes

```sql
delete from public.quotes;
```

### 4) Seed latest quotes

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/fetch-quotes"
```

### 5) Optional controlled historical backfill

If you need historical rows quickly (instead of waiting for lazy refill), call the same cron endpoint with `?date=YYYY-MM-DD`.

Example (single day):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/fetch-quotes?date=2026-02-16"
```

For a range, run day-by-day in your preferred scripting environment and throttle requests to respect provider limits.

## Validation queries

### Coverage and date span

```sql
select
  count(*) as quote_rows,
  count(distinct symbol_id) as symbols_with_quotes,
  min(date) as min_date,
  max(date) as max_date
from public.quotes;
```

### Position-linked symbols still missing quotes

```sql
with position_symbols as (
  select distinct symbol_id
  from public.positions
  where symbol_id is not null
)
select count(*) as position_symbols_without_quotes
from position_symbols ps
left join (
  select distinct symbol_id
  from public.quotes
) q on q.symbol_id = ps.symbol_id
where q.symbol_id is null;
```

### Offset sanity check (detect systemic +1 day drift)

```sql
select
  count(*) filter (where (date - (created_at at time zone 'UTC')::date) > 0) as positive_offsets,
  count(*) filter (where (date - (created_at at time zone 'UTC')::date) = 1) as plus_one_offsets
from public.quotes;
```

Expected: both counts should remain near zero after the refactor.

## Exit criteria

- Cron endpoint returns success.
- `max(date)` is current expected as-of date.
- Missing position-linked symbols are understood (for example, provider-unsupported tickers).
- No sustained quote insert/update errors in application logs.
