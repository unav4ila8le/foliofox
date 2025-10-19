# Sources Hub – Scalable Architecture Plan

## Goals

- Single entry-point for source-specific logic (no scattered symbol/domain checks)
- Pluggable, type-safe model to add new sources (real estate, crypto wallets, bank accounts, loans)
- Keep read paths simple; centralize branching in one place

## Core Concepts

- SourceDescriptor (discriminated union) is the only shape exposed for instrument identity. Avoid top-level symbol/domain fields on positions.

```ts
export type SourceDescriptor =
  | { type: "custom" }
  | { type: "symbol"; symbolId: string }
  | { type: "domain"; domain: string };
// Future: { type: "crypto_wallet"; walletAddress: string; blockchain: string } | ...
```

- Resolution helpers convert DB rows into descriptors:

```ts
// lib/sources/resolve.ts
export async function getSourceDescriptor(
  positionId: string,
): Promise<SourceDescriptor> {}
export async function getSourceDescriptors(
  positionIds: string[],
): Promise<Map<string, SourceDescriptor>> {}
```

- Registry-based operations route by descriptor.type:

```ts
// lib/sources/registry.ts
export interface SourceHandler<T extends SourceDescriptor = SourceDescriptor> {
  type: T["type"];
  getMarketKey(descriptor: T, date: Date): string | null;
  fetchPrices?(
    descriptors: T[],
    date: Date,
    opts?: { upsert?: boolean },
  ): Promise<Map<string, number>>;
}

export const SOURCE_HANDLERS: SourceHandler[] = [
  /* symbol, domain, ... */
];
```

- Market data aggregator accepts descriptors (reusing existing handlers internally):

```ts
export async function fetchMarketPrices(
  descriptors: SourceDescriptor[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<Map<string, number>> {}
```

## Read/Write Integration

- fetchPositions: return `source: SourceDescriptor` instead of raw IDs.
- position-snapshots/recalculate: use descriptor.type → call aggregator; no per-type conditionals outside registry.
- positions/create: keep hub writes (position_sources + per-type tables); return descriptor to caller.

## Implementation Steps (post-refactor)

1. Types: add `SourceDescriptor` and `SourceHandler`.
2. Helpers: implement `getSourceDescriptor(s)` via `position_sources_flat`.
3. Aggregator: add `fetchMarketPrices(descriptors, date)` thin wrapper over existing market-data handlers.
4. fetchPositions: include `source: SourceDescriptor`; remove top-level symbol/domain in returned shape.
5. position-snapshots/recalculate: swap to descriptors; remove scattered checks.
6. UI: forms produce descriptors; server maps to hub rows; add optional source edit.

## Benefits

- Add new source by creating one handler + extending the union.
- Stronger encapsulation; fewer call sites change over time.
- Simpler tests (handler-per-source).

## Notes

- Keep `position_sources_flat` as the normalized read surface (security invoker + barrier).
- Provide batch helpers to avoid N+1 (already used in snapshots recalculation).
