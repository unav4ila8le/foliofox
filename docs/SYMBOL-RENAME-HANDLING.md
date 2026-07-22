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

- `server/positions/stale.ts` keyset-paginates non-archived positions and marks them stale when:
  - `symbols.last_quote_at IS NULL`, or
  - `symbols.last_quote_at < now() - 7 days`
- A symbol with retired Yahoo ticker history and no active Yahoo ticker alias is
  instead marked `unavailable`, so it does not remain an indefinite stale warning.

### 3) User-facing warnings

- Dashboard data includes stale and unavailable market-data states via
  `DashboardDataProvider`.
- Assets table and asset page surface stale or neutral unavailable badges/messages.
- Users can manually switch symbols through the update-symbol flow (`server/positions/update-symbol.ts`).
- Unavailable positions also offer the existing archive flow while preserving history.

### 4) Provider alias retirement

- Live Yahoo quote, dividend, news, and quote-repair requests require an active
  Yahoo ticker alias (`effective_to IS NULL`).
- Retiring an alias stops future Yahoo requests without deleting the canonical
  symbol, positions, quotes, dividends, or primary/display metadata.
- UUID-based canonical resolution and inactive display fallback keep cached
  historical data readable after retirement.

### 5) Ticker reuse and canonical identity

- `symbols.id` is the durable identity. `symbols.ticker` is display metadata and
  is not used to decide which canonical symbol owns a current ticker.
- Active ticker aliases are unique by `(source, value)`. ISIN aliases may map
  one security to multiple listings. Alias values written by the application
  are trimmed and uppercased.
- Non-UUID ticker resolution chooses an active alias first, then the requested
  source (or Yahoo for source-unspecified ticker lookups), primary status, the
  most recent effective/retired timestamp, and alias UUID.
- Creating or refreshing a position, importing a current position, updating a
  position symbol, and resolving broker tickers require an active Yahoo ticker
  alias. A ticker that exists only in retired history therefore creates a new
  canonical UUID when Yahoo reuses it.
- Explicit symbol UUIDs continue to resolve the original canonical symbol, so
  cached quotes and position history remain attached to the old security.

### 6) Final lifecycle stage: orphan symbol cleanup

- The `symbols_cleanup` pg_cron job from migration
  `20251115073138_news_and_symbols_cleanup_pg_cron_jobs.sql` runs at 03:00 UTC
  on the first of each month.
- It deletes canonical symbols with no linked position. Foreign-key cascades then
  remove their quotes, dividends, dividend events, and aliases.
- Symbols retained by any position—including retired provider symbols—are not deleted.

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
