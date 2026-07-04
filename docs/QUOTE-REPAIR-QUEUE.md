# Quote Repair Queue

Foliofox keeps range chart reads cache-first. When an opted-in range read misses
an exact quote date, it enqueues async repair work in `public.quote_repair_queue`
instead of blocking the chart on Yahoo Finance.

## Flow

1. `fetchQuotes()` resolves exact cache hits first.
2. It then uses prior cached fallback rows within the stale window.
3. If `enqueueExactRepairOnNonExact` is enabled, remaining exact-date misses are
   inserted into `public.quote_repair_queue`.
4. `/api/cron/repair-quote-gaps` claims due jobs with the service-role client.
5. The worker resolves the current Yahoo alias through `resolveSymbolsBatch()`,
   fetches provider chart rows, upserts real market-day quotes, and marks each
   job outcome.

The worker never synthesizes weekend or holiday rows into `public.quotes`.

## Outcomes

- `resolved_exact`: the exact `(symbol_id, target_date)` quote now exists.
- `non_trading_or_no_exact`: Yahoo succeeded, but returned no exact target row.
- `pending`: transient provider failure; retry after `next_attempt_at`.
- `terminal_error`: max attempts reached or symbol metadata could not be
  resolved.

## Stale Symbols

Symbols whose `last_quote_at` is more than 7 calendar days before the target
date are throttled to one probe job per 7-day window. This prevents delisted or
unsupported symbols from filling the queue while still allowing recovered Yahoo
data to update `symbols.last_quote_at` and resume normal exact-date enqueueing.

## Operational Notes

- Cron path: `/api/cron/repair-quote-gaps`
- Schedule: hourly, offset from the daily market-data crons
- Batch size: 50 jobs
- Stale claim recovery: `in_progress` jobs older than 30 minutes can be
  reclaimed
- Backoff: 15 minutes, 1 hour, 6 hours, 24 hours; max 5 attempts
- Monthly backfill probe: `pg_cron` reopens up to 100
  `non_trading_or_no_exact` jobs older than 30 days. This gives Yahoo
  backfills another chance without retrying closed dates on every hourly run.

Queue monitoring and manual requeue SQL live in
[QUOTE-CACHE-RESEED.md](./QUOTE-CACHE-RESEED.md).
