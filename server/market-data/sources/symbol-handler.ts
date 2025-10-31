import { format } from "date-fns";

import { fetchQuotes } from "@/server/quotes/fetch";

import type {
  MarketDataHandler,
  SymbolRequest,
  MarketDataPosition,
} from "./types";

export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  async fetchForPositions(
    positions: MarketDataPosition[],
    date: Date,
    options?: { upsert?: boolean },
  ) {
    // Collect requests for symbol positions
    const requests: SymbolRequest[] = [];
    for (const p of positions) {
      if (p.symbol_id) {
        requests.push({ symbolId: p.symbol_id, date });
      }
    }

    // Fetch quotes if we have any requests
    if (requests.length === 0) return new Map();

    try {
      return await fetchQuotes(requests, options?.upsert);
    } catch {
      return new Map();
    }
  },

  async fetchForPositionsRange(
    positions: MarketDataPosition[],
    dates: Date[],
    options?: { upsert?: boolean; eligibleDates?: Map<string, Set<string>> },
  ) {
    const requests: SymbolRequest[] = [];
    const dedup = new Set<string>();

    for (const date of dates) {
      const dateKey = format(date, "yyyy-MM-dd");

      for (const position of positions) {
        if (!position.symbol_id) continue;

        const allowedDates = options?.eligibleDates?.get(position.id ?? "");
        if (allowedDates && !allowedDates.has(dateKey)) continue;

        const dedupKey = `${position.symbol_id}|${dateKey}`;
        if (dedup.has(dedupKey)) continue;
        dedup.add(dedupKey);

        requests.push({ symbolId: position.symbol_id, date });
      }
    }

    if (requests.length === 0) return new Map();

    try {
      return await fetchQuotes(requests, options?.upsert);
    } catch {
      return new Map();
    }
  },

  getKey(position: MarketDataPosition, date: Date) {
    if (!position.symbol_id) return null;
    return `${position.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
