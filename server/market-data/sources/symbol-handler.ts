import { fetchQuotes } from "@/server/quotes/fetch";
import { formatUTCDateKey } from "@/lib/date/date-utils";

import type {
  MarketDataHandler,
  SymbolRequest,
  MarketDataPosition,
  MarketDataFetchOptions,
  MarketDataRangeFetchOptions,
} from "./types";

export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  async fetchForPositions(
    positions: MarketDataPosition[],
    date: Date,
    options?: MarketDataFetchOptions,
  ) {
    // Collect requests for symbol positions
    const requests: SymbolRequest[] = [];
    for (const p of positions) {
      if (p.symbol_id) {
        requests.push({ symbolLookup: p.symbol_id, date });
      }
    }

    // Fetch quotes if we have any requests
    if (requests.length === 0) return new Map();

    try {
      return await fetchQuotes(requests, {
        upsert: options?.upsert,
      });
    } catch {
      return new Map();
    }
  },

  async fetchForPositionsRange(
    positions: MarketDataPosition[],
    dates: Date[],
    options?: MarketDataRangeFetchOptions,
  ) {
    const requests: SymbolRequest[] = [];
    const dedup = new Set<string>();

    for (const date of dates) {
      const dateKey = formatUTCDateKey(date);

      for (const position of positions) {
        if (!position.symbol_id) continue;

        const allowedDates = options?.eligibleDates?.get(position.id ?? "");
        if (allowedDates && !allowedDates.has(dateKey)) continue;

        const dedupKey = `${position.symbol_id}|${dateKey}`;
        if (dedup.has(dedupKey)) continue;
        dedup.add(dedupKey);

        requests.push({ symbolLookup: position.symbol_id, date });
      }
    }

    if (requests.length === 0) return new Map();

    try {
      return await fetchQuotes(requests, {
        upsert: options?.upsert,
        // Range reads stay cache-first by default. Callers must opt in to
        // provider repair after cached fallback coverage has been exhausted.
        liveFetchOnMiss: options?.liveFetchOnMiss ?? false,
      });
    } catch {
      return new Map();
    }
  },

  getKey(position: MarketDataPosition, date: Date) {
    if (!position.symbol_id) return null;
    return `${position.symbol_id}|${formatUTCDateKey(date)}`;
  },
};
