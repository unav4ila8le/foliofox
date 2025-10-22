"use server";

import type { MarketDataPosition } from "./sources/types";

/**
 * Fetch market prices in bulk for a given set of positions and date.
 *
 * Plug-and-play: Handlers are registered in one place (sources/registry.ts).
 * Adding a new source only requires a new handler + registry entry; callers
 * (e.g., fetchPositions, recalculation) pass minimal positions with IDs.
 *
 * Returns a unified map where keys are handler-specific (e.g., "AAPL|2024-01-15").
 *
 * @param positions - Minimal per-position identifiers (symbol_id/domain_id/...)
 * @param date - Date to fetch prices for
 * @param options.upsert - Whether to cache results in database (default: true)
 */
export async function fetchMarketData(
  positions: MarketDataPosition[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<Map<string, number>> {
  const { MARKET_DATA_HANDLERS } = await import("./sources/registry");

  const marketDataMap = new Map<string, number>();

  // Call each handler and merge results
  for (const handler of MARKET_DATA_HANDLERS) {
    const resultMap: Map<string, number> = await handler.fetchForPositions(
      positions,
      date,
      {
        upsert: options.upsert ?? true,
      },
    );

    // Merge into unified map
    resultMap.forEach((value: number, key: string) => {
      marketDataMap.set(key, value);
    });
  }

  return marketDataMap;
}
