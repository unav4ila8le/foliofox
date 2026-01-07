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

### Phase 1: Staleness Warnings (Current)

1. **Track last available quote** via `symbols.last_quote_at`
2. **Flag stale symbols** when timestamp is NULL or older than ~7 days
3. **Show dashboard warning** for affected positions:
   > "⚠️ We're having trouble fetching prices for OLDTICKER. [Update Symbol]"
4. **Notify code owner** via webhook for stale symbols (daily cron)

### Phase 2: Gap + Drift Detection (Future)

1. Detect quote gaps and metadata drift when Yahoo data arrives
2. Send higher-confidence alerts for potential ticker reuse

### Symbol Swap UI

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

**Automatic cleanup:** Monthly cron deletes symbols not referenced by any positions, cascading to quotes. No need to scope staleness checks.

### Detection Logic

#### In `server/quotes/fetch.ts` (Quote Fetching)

When successfully fetching from Yahoo chart API:

1. **Calculate new `last_quote_at`** from last chart quote date or `regularMarketTime`
2. **Update `last_quote_at`**: Only when `upsert === true` (cron, not AI tools)
3. **Monotonic guard**: Only update when the new value is greater than the stored value

#### In `app/api/cron/fetch-quotes/route.ts` (Daily Cron)

After quote fetching completes:

1. **Check staleness**: Query symbols where `last_quote_at` is NULL or older than 7 days
2. **Send webhook**: Notify code owner of stale symbols (daily digest)
3. **Error handling**: Catch and log Supabase/webhook failures
4. **No scoping needed**: Monthly cleanup removes unused symbols

#### User Dashboard Alerts

**Implementation:**

1. **Server action** `fetchStalePositions()` in `server/positions/stale.ts`:
   - Query non-archived positions with `symbol_id`
   - Join symbols where `last_quote_at IS NULL OR last_quote_at < now() - 7 days`
   - Return `StalePosition[]` with `{ positionId: string, ticker: string }`

2. **Dashboard context** via `DashboardDataProvider`:
   - Fetched once per dashboard layout load (parallel with other data)
   - Exposed as `stalePositions: StalePosition[]` (serializable)
   - Components use `useDashboardData()` hook

3. **UI integration**:
   - Assets table: show warning badge with ticker for stale positions
   - Asset page: show warning with "Update Symbol" action
   - Build `Map<positionId, ticker>` in table component for O(1) lookups

**Not webhook spam**: Users get proactive warnings, code owner gets targeted alerts.

#### Gap + Drift Detection (Phase 2)

When we enable higher-confidence detection:

1. **Read old `last_quote_at`** before updating (critical for gap detection)
2. **Detect gaps**: If old date exists and gap > 7 days, check for metadata drift
3. **Strong drift detection**: Compare stored symbol fields vs chart meta:
   - `currency` vs `chartData.meta.currency`
   - `exchange` vs `chartData.meta.exchangeName`
   - `quote_type` vs `chartData.meta.instrumentType`
4. **Critical alerts**: Gap + strong drift → log and send webhook

**Conservative approach:** Log and alert, but don't auto-delete contaminated data without human verification.

### User Notification

**Phase 1 (Current):** Dashboard warnings for users when their positions reference stale symbols (7+ days old).

**Phase 2 (Future):** Enhanced alerts with symbol update options.

### Code Owner Notifications

**Phase 1:** Daily webhook digest of stale symbols (7+ days old).

**Phase 2:** Discord webhooks for high-confidence signals (gap + strong drift).

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
