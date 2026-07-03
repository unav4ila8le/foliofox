# Async Exact-Date Quote Repair Queue

Reviewed against the current codebase on 2026-07-03.

## Current Codebase Review

- `fetchQuotes()` already resolves quotes as `exact cache hit -> prior cached fallback -> optional live fetch`.
- Range market-data reads are cache-first by default: `symbolHandler.fetchForPositionsRange()` passes `liveFetchOnMiss: false` unless the caller opts in.
- `fetchNetWorthHistory()` is the important exception today: it still opts range history into blocking live repair with `liveFetchOnMiss: true`.
- The daily `/api/cron/fetch-quotes` route still owns the rolling `D`, `D-1`, `D-2` refresh and uses `staleGuardDays: 0` so those dates stay distinct.
- There is no queue table, enqueue helper, server-side claim helper, or repair worker in the current codebase.
- Quote rows store provider market days only and normalized major-currency prices. `symbols.quote_to_currency_rate` is already part of the quote path.
- `symbols.last_quote_at` already tracks the latest provider quote date and should be used to avoid endlessly queueing dead/delisted symbols while still allowing periodic recovery probes.
- Vercel Pro removes the old practical blocker for another cron: current Vercel docs list Pro as 100 cron jobs per project with a once-per-minute minimum interval. Cron delivery can still overlap, duplicate, or miss runs, so the worker must be idempotent.

References:

- `server/quotes/fetch.ts`
- `server/market-data/sources/symbol-handler.ts`
- `server/analysis/net-worth/net-worth-history.ts`
- `app/api/cron/fetch-quotes/route.ts`
- `vercel.json`
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs

## Core Goal

Keep chart/history reads fast by leaving range reads cache-first, then repair exact-date quote gaps asynchronously.

The important behavior is:

- Return immediately from range reads after exact cache and prior-cache fallback.
- Enqueue repair work only for opted-in range callers when the requested effective date was not an exact cache hit.
- Avoid per-date repair churn for symbols whose provider quote stream looks stale, but keep periodic probes so revived/backfilled symbols can recover.
- Repair by writing real provider market-day rows only.
- Never synthesize weekend or holiday rows into `public.quotes`.

## What Changed From The Old Plan

- Keep the async queue idea. It is still the right core fix.
- Do not add a `retryable_error` status. Use `pending + next_attempt_at + attempt_count + last_error` for retries; it is less state to keep consistent.
- Do not use Vercel Queues, Supabase RPCs, or another dependency. Keep Postgres as queue storage and claim jobs from the Next cron.
- Do not split provider requests into 14-day spans in v1. The claimed batch size is the bound; add span chunking only if provider/runtime data says it is needed.
- Do not call `fetchQuotes()` as the worker's source of truth for final status. It intentionally hides some provider failures and can return fallback prices. The worker can reuse quote normalization utilities, but it should mark jobs by checking whether the exact target row exists after its provider fetch.
- Add stale-symbol throttling so delisted symbols do not create one new repair job every day forever, without permanently suppressing symbols that Yahoo later backfills.
- Keep single-date quote behavior unchanged.

## Updated Phased Plan

### Phase 1: Queue Storage Schema

Prerequisite: create an empty Supabase migration file first, then edit that file only.

Add `public.quote_repair_queue`:

- `id uuid primary key default gen_random_uuid()`
- `symbol_id uuid not null references public.symbols(id) on update cascade on delete cascade`
- `target_date date not null`
- `status text not null default 'pending'`
- `attempt_count integer not null default 0`
- `next_attempt_at timestamptz not null default now()`
- `claimed_at timestamptz`
- `last_error text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique `(symbol_id, target_date)`

Allowed statuses:

- `pending`
- `in_progress`
- `resolved_exact`
- `non_trading_or_no_exact`
- `terminal_error`

Indexes:

- unique index/constraint on `(symbol_id, target_date)`
- partial index on `(next_attempt_at, created_at)` where `status = 'pending'`
- partial index on `claimed_at` where `status = 'in_progress'`

No caller behavior changes in this phase.

Phase 1 checks:

- migration applies locally by the user
- user regenerates Supabase types
- `npm run type`

### Phase 2: Enqueue Opt-In From The Fast Quote Path

Add a small queue helper, likely under `server/quotes/repair-queue.ts`.

Add options:

- `FetchQuotesOptions.enqueueExactRepairOnNonExact?: boolean`
- `MarketDataRangeFetchOptions.enqueueExactRepairOnNonExact?: boolean`

Propagate the flag through:

- `fetchMarketDataRange()`
- `symbolHandler.fetchForPositionsRange()`
- `fetchQuotes()`

In `fetchQuotes()`:

- keep exact-hit and fallback return behavior unchanged
- after prior-cache fallback, find requests whose effective date was not an exact cache hit
- when the enqueue flag is true, insert `(symbol_id, target_date)` queue rows for those requests
- use the effective date, not the raw requested date
- skip Saturday/Sunday for non-crypto symbols
- allow Saturday/Sunday for `symbols.quote_type = 'CRYPTOCURRENCY'`
- for symbols whose `last_quote_at` is recent enough, enqueue the exact requested `target_date`
- for symbols whose `last_quote_at` is more than 7 calendar days before `target_date`, enqueue at most one probe job per symbol per throttle window instead of one job per requested date
- use a probe throttle window of 7 days in v1
- key stale-symbol probe jobs by the requested effective `target_date` that triggered the probe, but suppress additional stale probes when the symbol already has any pending/in-progress repair job or any completed probe created in the last 7 days
- when `symbols.last_quote_at` is null, treat the symbol as probe-only after the first failed repair outcome, using the same 7-day throttle
- use conflict-do-nothing semantics so repeated chart loads do not duplicate jobs

The enqueue helper can bulk-load `symbols.id, symbols.quote_type, symbols.last_quote_at` for candidate symbol IDs. Do not add a market-calendar table in v1.

This is intentionally a throttle, not a permanent stale-symbol ban. If Yahoo resumes or backfills a symbol, the next allowed probe can update `quotes` and `symbols.last_quote_at`; after that, normal exact-date enqueue resumes.

Do not flip net-worth history yet. This keeps the queue path dark until the worker exists.

Phase 2 tests:

- exact cache hits do not enqueue
- weekday non-exact fallback enqueues one row
- unresolved weekday requests enqueue one row
- duplicate non-exact reads do not duplicate rows
- equity weekend requests do not enqueue
- crypto weekend requests do enqueue
- stale symbols enqueue at most one probe per throttle window
- a successful stale-symbol probe updates `last_quote_at` and allows normal enqueue again
- range handler forwards the enqueue flag

### Phase 3: Repair Worker Cron

Add `app/api/cron/repair-quote-gaps/route.ts` using the existing cron route pattern:

- `connection()`
- `Authorization: Bearer ${CRON_SECRET}`
- structured JSON stats
- no user-scoped Supabase client

Worker behavior:

- claim a bounded batch in the Next cron with normal Supabase calls:
  - select due `pending` rows plus stale `in_progress` rows, ordered by due time, limit 100
  - update selected rows to `in_progress` with `claimed_at = now()`
  - include the original status/staleness predicate in the update so overlapping cron runs do not both claim the same rows
  - use the rows returned by the update as the actual claimed batch
- group claimed jobs by symbol
- fetch symbol metadata needed for Yahoo: ticker/alias, quote type, and quote unit multiplier
- fetch Yahoo chart rows for the claimed target span per symbol
- normalize rows with existing quote normalization behavior
- upsert only returned provider market-day rows into `quotes`
- update `symbols.last_quote_at` for returned rows using the existing monotonic grouped-update pattern
- mark each job:
  - `resolved_exact` if `quotes` now has `(symbol_id, target_date)`
  - `non_trading_or_no_exact` if the provider call succeeded but no exact target row exists
  - `pending` with the next backoff time if a transient/provider error happened and attempts remain
  - `terminal_error` after max attempts

Backoff:

- 15 minutes
- 1 hour
- 6 hours
- 24 hours
- max 5 attempts

Add one Vercel cron, offset from existing minute-0 jobs:

```json
{
  "path": "/api/cron/repair-quote-gaps",
  "schedule": "17 * * * *"
}
```

If queue lag remains high after observing production, change only the schedule or batch size first. Pro supports once-per-minute cron intervals, but hourly is the lazy starting point.

Phase 3 tests:

- unauthorized request returns 401
- empty claim returns zero-work stats
- exact provider row marks `resolved_exact`
- holiday/no exact row marks `non_trading_or_no_exact`
- transient provider failure schedules retry
- final failed attempt marks `terminal_error`
- already-resolved quote rows are idempotent on duplicate/overlapping runs

### Phase 4: Flip Net-Worth History And Docs

Change `fetchNetWorthHistory()` range fetch from blocking live repair to async repair:

- remove `liveFetchOnMiss: true`
- add `enqueueExactRepairOnNonExact: true`

Keep single-date paths unchanged:

- create/update position quote lookup
- point-in-time valuation
- ad-hoc AI historical quote tools unless explicitly changed later

Update docs:

- `docs/QUOTE-FETCH-BEHAVIOR.md`
- `docs/QUOTE-CACHE-RESEED.md`
- `docs/MARKET-DATA-HUB.md`

Add queue runbook queries:

```sql
select status, count(*) as jobs
from public.quote_repair_queue
group by status
order by status;
```

```sql
select count(*) as due_pending_jobs
from public.quote_repair_queue
where status = 'pending'
  and next_attempt_at <= now();
```

Phase 4 tests:

- net-worth history passes `enqueueExactRepairOnNonExact: true`
- net-worth history does not pass `liveFetchOnMiss: true`
- cold-cache history still returns fast fallback/snapshot values

## Out Of Scope For V1

- Full exchange calendars.
- Market holiday preclassification.
- UI for queue status.
- New queue/vendor dependency.
- Rewriting daily `/api/cron/fetch-quotes`.
- Repairing FX gaps; this plan is quotes only.
