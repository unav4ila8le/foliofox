# Quote Fetch Behavior

This document explains how Foliofox resolves quote prices for symbol-backed positions.

It focuses on behavior, not implementation details, so it should stay useful even as the code evolves.

## Scope

- Symbol-backed market data (`quotes`)
- Single-date quote reads
- Range quote reads used by charts and other history consumers
- How chart history falls back when some market days are still unresolved

## Key Terms

- `requestedDateKey`: the date the caller asked for
- `effectiveDateKey`: the provider-facing as-of date after applying the "today before cutoff" rule
- exact cache hit: a `quotes` row exists for the exact effective date
- cached fallback: use the latest prior cached quote within the configured stale window
- live read repair: call Yahoo Finance for unresolved requests and upsert returned market-day rows

## Core Rules

### 1) Quote rows are stored only for provider market days

We do not synthesize weekend or holiday rows into `public.quotes`.

That means a warm cache can still have exact-date misses for calendar dates that were not trading days.

### 2) Quote resolution is cache-first

`fetchQuotes()` resolves requests in this order:

1. Resolve the symbol lookup to a canonical `symbols.id`
2. Compute `effectiveDateKey`
3. Check the quote cache for an exact-date row
4. If exact-date lookup misses, look for the latest prior cached quote within `staleGuardDays`
5. If the request is still unresolved and `liveFetchOnMiss` is enabled, call Yahoo Finance and upsert returned market-day rows
6. Return results under both canonical and original lookup keys when needed

Important:

- Cached fallback now happens before live read repair
- This avoids unnecessary provider calls for warm-cache weekend and holiday requests

## Effective Date Behavior

By default, a request for "today" before the quote cutoff is remapped to the previous UTC day.

This prevents the app from treating an incomplete market day as a final daily close.

Cron backfills override this behavior and keep `D`, `D-1`, and `D-2` distinct.

## Single-Date vs Range Reads

### Single-date reads

Examples:

- position create
- point-in-time valuation
- update-form historical quote lookup

Default behavior:

- exact cache hit
- prior cached fallback within stale window
- live read repair on remaining misses

This keeps point lookups resilient and helps warm the cache over time.

### Range reads

Examples:

- net worth history
- other bulk chart/history consumers

Default behavior:

- exact cache hit
- prior cached fallback within stale window
- no live read repair unless the caller explicitly opts in

Why:

- Range requests often span many calendar days
- Weekend and holiday exact-date misses are normal
- Enabling provider repair by default for all range reads can degrade chart latency

## Net Worth History Behavior

`fetchNetWorthHistory()` explicitly opts range reads into live read repair after cached fallback coverage has already been attempted.

This gives the chart a better cold-start path without regressing the warm-cache case that previously caused slow loads.

## Chart Valuation Fallback Order

After market data has been resolved for a history range, daily valuation synthesis uses this order for each position/day:

1. exact market quote for that day
2. latest prior market quote already seen in the synthesized series
3. snapshot `unit_value`

Important boundary rule:

- A carried-forward market quote is only valid within the active snapshot window
- We do not carry an older market quote across a newer snapshot boundary

This prevents old market data from overriding a newer snapshot state.

## Practical Examples

### Warm cache weekend request

- Requested day is Sunday
- No exact `quotes` row exists for Sunday
- Friday quote exists in cache and is within `staleGuardDays`
- Result resolves from cache
- No provider call is made

### Cold historical trading day

- Requested day is a trading day
- No exact cache row exists
- No recent prior cached quote exists
- Caller allows live read repair
- Yahoo Finance is queried and returned market-day rows are upserted

### Sparse history range

- Some trading days are resolved from cache/provider
- A later calendar day still has no exact market quote
- The chart first carries forward the latest prior market quote
- Only if there is no valid carried quote does it fall back to the snapshot value

## Operational Notes

- Cron quote refresh fills a rolling 3-day window: `D`, `D-1`, `D-2`
- A cold local database will remain sparse unless:
  - cron backfills it
  - single-date reads warm specific dates
  - a range caller explicitly opts into live read repair

## Related Files

- `server/quotes/fetch.ts`
- `server/market-data/sources/symbol-handler.ts`
- `server/analysis/net-worth/net-worth-history.ts`
- `server/analysis/valuations-history/synthesize.ts`

## Related Docs

- [MARKET-DATA-HUB.md](./MARKET-DATA-HUB.md)
- [QUOTE-CACHE-RESEED.md](./QUOTE-CACHE-RESEED.md)
- [DATE-HANDLING.md](./DATE-HANDLING.md)
