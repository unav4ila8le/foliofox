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

  getKey(position: MarketDataPosition, date: Date) {
    if (!position.symbol_id) return null;
    return `${position.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
