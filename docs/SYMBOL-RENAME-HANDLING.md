# Symbol Rename Handling

## Problem

Yahoo Finance renames or retires ticker symbols without providing any API data about these changes. When this happens, quote fetches fail and users see stale prices.

## Why Our Schema Handles This Well

**Key insight:** `position_snapshots` and `portfolio_records` store values by `position_id`, not `symbol_id`.

| Table                | Stores `symbol_id`? |
| -------------------- | ------------------- |
| `positions`          | ✅ Yes              |
| `position_snapshots` | ❌ No               |
| `portfolio_records`  | ❌ No               |

This means changing a position's symbol only affects future market data lookups. Historical net worth uses stored `snapshot.unit_value` as fallback when market data is unavailable.

## Solution: User-Notified, User-Driven

Since Yahoo provides no rename detection, we notify users of data issues and let them update the symbol.

### Phase 1: Detection & Notification

1. **Track last available quote** via `symbols.last_quote_at`
2. **Flag stale symbols** when timestamp is NULL or older than ~7 days
3. **Show dashboard warning** for affected positions:
   > "⚠️ We're having trouble fetching prices for OLDTICKER. [Update Symbol]"

### Phase 2: Symbol Swap UI

1. Add "Change Symbol" action to position settings
2. User searches and selects the new/correct symbol
3. System validates with Yahoo Finance
4. Updates `positions.symbol_id` to the new symbol UUID

### Phase 3: Preserve Historical Integrity

When swapping symbols, **never modify**:

- `position_snapshots` (historical quantity/value records)
- `portfolio_records` (buy/sell/update transactions)

The stored values were correct at recording time and remain the source of truth.

## Implementation Details

### Symbol Health Tracking

Single column on `symbols` table:

- `last_quote_at: timestamptz` – the date of the most recent quote from Yahoo (not when we fetched)

**Why single column works:** Yahoo often keeps renamed symbols with frozen history (no error, just no recent data). We detect staleness by the actual market date, not our fetch attempt.

**Staleness threshold:** ~7 days accounts for weekends, holidays, and occasional API hiccups.

### Detection Logic

In `server/quotes/fetch.ts`, when successfully fetching from Yahoo:

1. Use last chart quote date if available; fallback to `regularMarketTime`
2. Only update when `upsert === true` (cron job, not AI tools)
3. Guard against regression: only update if new date > existing `last_quote_at`

### User Notification

Query flagged symbols linked to user's positions and display alert in dashboard header or position detail page.

### Symbol Swap Action

Server action in `server/positions/update.ts`:

1. Accept new `symbolLookup` value
2. Resolve to canonical UUID via `resolveSymbolInput()`
3. Validate symbol exists in Yahoo Finance
4. Update `positions.symbol_id`
5. Optionally: trigger quote fetch for current date

## Why This Approach

| Criterion          | Status                                 |
| ------------------ | -------------------------------------- |
| Deterministic      | ✅ User explicitly chooses replacement |
| No false positives | ✅ No automated guessing               |
| Data integrity     | ✅ Historical records untouched        |
| User agency        | ✅ User controls their data            |
| Minimal complexity | ✅ No heuristic matching               |

## Related

- [SYMBOL-UUID-PLAN.md](./SYMBOL-UUID-PLAN.md) – UUID and alias infrastructure
- [MARKET-DATA-HUB.md](./MARKET-DATA-HUB.md) – Market data fetching architecture
- GitHub Issue #29 – Original issue tracking this feature
