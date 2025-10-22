# Market Data Sources – Plug-and-Play Architecture (Current)

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
export async function fetchMarketData(
  positions: MarketDataPosition[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<Map<string, number>> {
  /* calls each handler and merges */
}
```

## Read/Write Integration

- fetchPositions: read `symbol_id`/`domain_id` and build minimal `MarketDataPosition` for aggregator.
- position-snapshots/recalculate: same; derive handler via which ID is present.
- positions/create: write IDs directly to `positions`.

## Implementation Steps

1. Add/extend a MarketDataHandler in `server/market-data/sources/*`.
2. Register it in `server/market-data/sources/registry.ts`.
3. Ensure DB cache table exists (quotes, valuations, etc.) and implement fetch logic.
4. No changes needed in `fetchPositions` beyond using present IDs; aggregator remains stable.

## Benefits

- Add new source by creating one handler and registering it.
- No hub tables or view maintenance.
- Minimal surface area: `fetchPositions` and recalculation stay unchanged.

## Notes

- Batch requests in handlers to avoid N+1.
