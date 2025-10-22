"use server";

import {
  resolveMarketDataForPositions,
  type MarketDataResolution,
} from "./sources/resolver";

import type { MarketDataPosition } from "./sources/types";

export interface MarketDataFetchResult {
  prices: Map<string, number>;
  resolvedPositionIds: Set<string>;
  resolutions: Map<string, MarketDataResolution>;
}

/**
 * Fetch market prices in bulk for a given set of positions and date.
 *
 * Plug-and-play: Handlers are registered in one place (sources/registry.ts).
 * Adding a new source only requires a new handler + registry entry; callers
 * (e.g., fetchPositions, recalculation) pass minimal positions with IDs.
 *
 * Returns position-id keyed prices along with the resolver map so callers
 * don't need to branch on individual identifiers.
 *
 * @param positions - Minimal per-position identifiers (symbol_id/domain_id/...)
 * @param date - Date to fetch prices for
 * @param options.upsert - Whether to cache results in database (default: true)
 */
export async function fetchMarketData(
  positions: MarketDataPosition[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<MarketDataFetchResult> {
  const { MARKET_DATA_HANDLERS } = await import("./sources/registry");

  const resolutions = resolveMarketDataForPositions(
    MARKET_DATA_HANDLERS,
    positions,
    date,
  );

  const prices = new Map<string, number>();
  const resultsBySource = new Map<string, Map<string, number>>();

  for (const handler of MARKET_DATA_HANDLERS) {
    const result = await handler.fetchForPositions(positions, date, {
      upsert: options.upsert ?? true,
    });
    resultsBySource.set(handler.source, result);
  }

  resolutions.forEach((resolution, positionId) => {
    const handlerResult = resultsBySource.get(resolution.handler.source);
    if (!handlerResult) return;

    const value = handlerResult.get(resolution.key);
    if (value !== undefined) {
      prices.set(positionId, value);
    }
  });

  return {
    prices,
    resolvedPositionIds: new Set(resolutions.keys()),
    resolutions,
  };
}
