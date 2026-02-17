# FX Cache Reseed Runbook

This runbook covers how to safely reset and repopulate `public.exchange_rates` when cache data is stale, drifted, or intentionally purged.

It is intentionally implementation-light so it remains useful as the codebase evolves.

## When to use this

- FX cache has known drift versus provider data.
- FX fetch logic changed and old rows are no longer trusted.
- You intentionally purged `public.exchange_rates` and need controlled refill.

## Pre-checks

1. Latest exchange-rate related code is deployed in the target environment.
2. `CRON_SECRET` is configured in deployment.
3. You can call:
   - `GET /api/cron/fetch-exchange-rates`
4. Optional: enable maintenance mode if you want zero user traffic during reseed.

## Recommended strategy

Use a two-stage refill:

1. **Seed latest data first** (single cron call).
2. **Backfill history only if needed** (date-override loop).

This avoids unnecessary provider traffic and keeps operational risk low.

## Procedure

### 1) Optional maintenance window

If your deployment supports maintenance mode, enable it before purge/reseed and disable it after validation.

### 2) Purge exchange rates

```sql
delete from public.exchange_rates;
```

### 3) Seed latest FX rates

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/fetch-exchange-rates"
```

### 4) Backfill last 365 days (recommended one-off loop)

macOS example:

```bash
for i in $(seq 0 364); do
  date_key=$(date -u -v-"$i"d +%Y-%m-%d)
  echo "Seeding ${date_key}"
  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
    "https://<your-domain>/api/cron/fetch-exchange-rates?date=${date_key}" > /dev/null
  sleep 0.1
done
```

### 5) Optional controlled historical backfill (single date)

If you need historical rows quickly (instead of waiting for lazy refill), call the same cron endpoint with `?date=YYYY-MM-DD`.

Example (single day):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/fetch-exchange-rates?date=2026-02-16"
```

For a range, run day-by-day in your preferred scripting environment and throttle requests to respect provider limits.

## Validation queries

### Coverage and date span

```sql
select
  count(*) as fx_rows,
  count(distinct target_currency) as currencies_with_rates,
  min(date) as min_date,
  max(date) as max_date
from public.exchange_rates
where base_currency = 'USD';
```

### Position currencies still missing USD FX rows

```sql
with used_currencies as (
  select distinct currency
  from public.positions
  where currency is not null
    and currency <> 'USD'
)
select count(*) as position_currencies_without_rates
from used_currencies uc
left join (
  select distinct target_currency
  from public.exchange_rates
  where base_currency = 'USD'
) er on er.target_currency = uc.currency
where er.target_currency is null;
```

### Offset sanity check (detect systematic +1 behavior)

```sql
select
  count(*) filter (where (date - (created_at at time zone 'UTC')::date) > 0) as positive_offsets,
  count(*) filter (where (date - (created_at at time zone 'UTC')::date) = 1) as plus_one_offsets
from public.exchange_rates
where base_currency = 'USD';
```

Expected: both counts should remain near zero after the refactor.

## Exit criteria

- Cron endpoint returns success.
- `max(date)` is current expected as-of date.
- Missing position currencies are understood.
- No sustained FX insert/update errors in application logs.
