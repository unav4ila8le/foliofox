"use server";

import {
  resolveMarketDataForPositions,
  type MarketDataResolution,
} from "./sources/resolver";
import { formatUTCDateKey } from "@/lib/date/date-utils";

import type { MarketDataPosition } from "./sources/types";
import type { TransformedPosition } from "@/types/global.types";

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

/**
 * Fetch market prices in bulk for a given set of positions and multiple dates.
 *
 * Returns a map keyed by `${positionId}|yyyy-MM-dd` so callers can efficiently
 * look up values for any date in the requested range without branching on
 * source type (symbol/domain/etc.).
 *
 * Handlers that implement `fetchForPositionsRange` will batch across dates;
 * others will fall back to per-date fetches via their single-date method.
 */
export async function fetchMarketDataRange(
  positions: MarketDataPosition[],
  dates: Date[],
  options: { upsert?: boolean; eligibleDates?: Map<string, Set<string>> } = {},
): Promise<Map<string, number>> {
  if (!positions.length || !dates.length) return new Map();

  const { MARKET_DATA_HANDLERS } = await import("./sources/registry");

  const upsert = options.upsert ?? true;
  const eligibleDates = options.eligibleDates;

  // Normalize and dedupe requested dates
  const uniqueDates: Date[] = [];
  const seenDateKeys = new Set<string>();
  for (const rawDate of dates) {
    const date = new Date(rawDate);
    const dateKey = formatUTCDateKey(date);
    if (seenDateKeys.has(dateKey)) continue;
    seenDateKeys.add(dateKey);
    uniqueDates.push(date);
  }

  if (!uniqueDates.length) return new Map();

  uniqueDates.sort((a, b) => a.getTime() - b.getTime());

  const positionsWithEligibility = eligibleDates
    ? positions.filter((p) => p.id && eligibleDates.get(p.id)?.size)
    : positions.slice();

  if (!positionsWithEligibility.length) return new Map();

  // Build handler -> positions map for handlers that can service at least one position
  const handlerToPositions = new Map<string, MarketDataPosition[]>();
  for (const handler of MARKET_DATA_HANDLERS) {
    const supportedPositions = positionsWithEligibility.filter((p) => {
      if (!uniqueDates.length) return false;
      return handler.getKey(p, uniqueDates[0]) !== null;
    });

    if (supportedPositions.length) {
      handlerToPositions.set(handler.source, supportedPositions);
    }
  }

  const handlerResults = new Map<string, Map<string, number>>();

  for (const handler of MARKET_DATA_HANDLERS) {
    const posForHandler = handlerToPositions.get(handler.source);
    if (!posForHandler?.length) continue;

    if (typeof handler.fetchForPositionsRange === "function") {
      const result = await handler.fetchForPositionsRange(
        posForHandler,
        uniqueDates,
        {
          upsert,
          eligibleDates,
        },
      );
      handlerResults.set(handler.source, result);
    } else {
      const aggregated = new Map<string, number>();
      for (const date of uniqueDates) {
        const dateKey = formatUTCDateKey(date);
        const positionsForDate = posForHandler.filter((position) => {
          if (!eligibleDates) return true;
          if (!position.id) return false;
          const allowed = eligibleDates.get(position.id);
          return allowed ? allowed.has(dateKey) : false;
        });

        if (!positionsForDate.length) continue;

        const result = await handler.fetchForPositions(positionsForDate, date, {
          upsert,
        });

        result.forEach((value, key) => {
          if (!aggregated.has(key)) {
            aggregated.set(key, value);
          }
        });
      }

      handlerResults.set(handler.source, aggregated);
    }
  }

  const prices = new Map<string, number>();

  for (const handler of MARKET_DATA_HANDLERS) {
    const posForHandler = handlerToPositions.get(handler.source);
    if (!posForHandler?.length) continue;

    const result = handlerResults.get(handler.source);
    if (!result || result.size === 0) continue;

    for (const position of posForHandler) {
      if (!position.id) continue;

      const allowedDates = eligibleDates?.get(position.id);

      for (const date of uniqueDates) {
        const dateKey = formatUTCDateKey(date);
        if (allowedDates && !allowedDates.has(dateKey)) continue;

        const handlerKey = handler.getKey(position, date);
        if (!handlerKey) continue;

        const value = result.get(handlerKey);
        if (value === undefined) continue;

        prices.set(`${position.id}|${dateKey}`, value);
      }
    }
  }

  return prices;
}

/**
 * Adapt full positions to the minimal MarketDataPosition shape expected by the hub.
 * Keeps source-specific knowledge centralized here (symbol_id, domain_id, etc.).
 */
export async function toMarketDataPositions(
  positions: Array<
    Pick<TransformedPosition, "id" | "currency" | "symbol_id" | "domain_id">
  >,
): Promise<MarketDataPosition[]> {
  return positions.map((p) => ({
    id: p.id,
    currency: p.currency,
    symbol_id: p.symbol_id ?? null,
    domain_id: p.domain_id ?? null,
  }));
}
