# Symbol Rename Handling

## Problem

Yahoo Finance can rename or retire tickers without providing a first-class rename feed. When this happens, quote refreshes may stop and users see stale market data.

## Why historical data remains safe

`position_snapshots` and `portfolio_records` are keyed by `position_id`, not `symbol_id`.

| Table                | Stores `symbol_id`? |
| -------------------- | ------------------- |
| `positions`          | ✅ Yes              |
| `position_snapshots` | ❌ No               |
| `portfolio_records`  | ❌ No               |

Changing a position symbol affects future quote lookups only. Historical records remain intact.

## Current behavior (implemented)

### 1) Symbol health tracking

- `symbols.last_quote_at` stores the latest market date successfully observed for a symbol.
- `server/quotes/fetch.ts` updates `last_quote_at` only when `upsert` is enabled.
- Updates are monotonic (`last_quote_at` only moves forward).

### 2) Stale position detection

- `server/positions/stale.ts` marks non-archived positions as stale when:
  - `symbols.last_quote_at IS NULL`, or
  - `symbols.last_quote_at < now() - 7 days`

### 3) User-facing warnings

- Dashboard data includes stale positions via `DashboardDataProvider`.
- Assets table and asset page surface stale badges/messages.
- Users can manually switch symbols through the update-symbol flow (`server/positions/update-symbol.ts`).

### 4) Orphan symbol cleanup

- Unlinked symbols are removed by monthly cleanup (see Supabase cron migration).
- This keeps stale checks focused on symbols that still matter.

## What is not automated today

- No automatic ticker rename detection/remapping.
- No cron-based stale-symbol webhook digest.
- No gap-plus-drift alert pipeline.

These can be added later if operational needs justify the extra complexity.

## Future enhancements (optional)

1. Gap detection based on `last_quote_at` jumps.
2. Drift checks against Yahoo metadata (`currency`, `exchange`, `instrumentType`).
3. Optional maintainer alerts for high-confidence rename signals.

## Related

- [MARKET-DATA-HUB.md](./MARKET-DATA-HUB.md) – market data handler architecture
- [QUOTE-CACHE-RESEED.md](./QUOTE-CACHE-RESEED.md) – quote cache reset/reseed procedure
