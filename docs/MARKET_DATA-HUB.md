# Market Data Sources – Plug-and-Play Architecture

## Goals

- Single entry-point for source-specific logic (no scattered symbol/domain checks)
- Pluggable, type-safe model to add new sources (real estate, crypto wallets, bank accounts, loans)
- Keep read paths simple; centralize branching in one place

## Core Concepts

- Positions store nullable identifiers directly (e.g., `symbol_id`, `domain_id`). If all are null → custom position.

- No hub resolution layer is needed. Reads pull identifiers directly from `positions`.

- Registry-based operations route by descriptor.type:

```ts
// server/market-data/sources/types.ts
export type MarketDataPosition = {
  id: string;
  currency: string;
  symbol_id?: string | null;
  domain_id?: string | null;
  // future: wallet_address?: string | null; property_id?: string | null; ...
};

export interface MarketDataHandler {
  source: string; // 'symbol' | 'domain' | 'wallet' | 'property' | ...
  fetchForPositions(
    positions: MarketDataPosition[],
    date: Date,
    options?: { upsert?: boolean },
  ): Promise<Map<string, number>>;
  getKey(position: MarketDataPosition, date: Date): string | null;
}

export const MARKET_DATA_HANDLERS: MarketDataHandler[] = [
  /* symbol, domain, ... */
];
```

- Market data aggregator accepts descriptors (reusing existing handlers internally):

```ts
import type { MarketDataResolution } from "@/server/market-data/sources/resolver";

export async function fetchMarketData(
  positions: MarketDataPosition[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<{
  prices: Map<string, number>;
  resolvedPositionIds: Set<string>;
  resolutions: Map<string, MarketDataResolution>;
}> {
  /* calls each handler, maps results by position.id */
}
```

## Read/Write Integration

- fetchPositions: pass `id`/`symbol_id`/`domain_id` directly to the aggregator; lookups come back by `position.id`.
- position-snapshots/recalculate: remains transaction-driven; uses stored unit values and does not call the market data hub.
- positions/create: write IDs directly to `positions`.
- `resolveMarketDataKey` / `resolveMarketDataForPositions`: shared helpers that map positions to handlers/keys so callers avoid inline branching.

## Implementation Steps

1. Add/extend a MarketDataHandler in `server/market-data/sources/*`.
2. Register it in `server/market-data/sources/registry.ts`.
3. Ensure DB cache table exists (quotes, valuations, etc.) and implement fetch logic.
4. Callers provide `position.id` plus any source identifiers; the hub resolves keys internally.

## Adding a New Source

1. **Model the identifier**
   - Add the nullable identifier column to `positions` (e.g., `crypto_wallet_id`) and surface it through `TransformedPosition` so it flows into `MarketDataPosition`.

2. **Create a handler**
   - Add `server/market-data/sources/<source>-handler.ts`.
   - Implement `fetchForPositions` to batch requests and call your underlying service. Return `Map<handlerKey, number>`.
   - Implement `getKey` to build a deterministic string based on the position identifier and date (e.g., `${walletId}|${yyyy-MM-dd}`).

3. **Register the handler**
   - Append the handler to `MARKET_DATA_HANDLERS` in `server/market-data/sources/registry.ts`. Order does not matter, but group similar sources when possible.

4. **Backfill/cache requirements**
   - Ensure the supporting fetcher (e.g., `server/crypto-wallets/fetch.ts`) and any cache tables exist so `fetchForPositions` can upsert results.

5. **Verify hub consumers**
   - `fetchPositions` and other callers rely on `resolveMarketDataForPositions`. No additional branching is required—just ensure the new identifier is populated on positions and the handler returns data.
   - Optionally expand tests to cover the new handler and its interaction with the market-data hub.

## Benefits

- Add new source by creating one handler and registering it.
- No hub tables or view maintenance.
- Minimal surface area: read paths consume hub output keyed by position ID; recalculation stays unchanged.

## Notes

- Batch requests in handlers to avoid N+1.
