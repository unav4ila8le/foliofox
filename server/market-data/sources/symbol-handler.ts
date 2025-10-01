import { format } from "date-fns";

import { fetchQuotes } from "@/server/quotes/fetch";

import type { TransformedHolding } from "@/types/global.types";
import type { SymbolMarketDataHandler, SymbolRequest } from "./types";

export const symbolHandler: SymbolMarketDataHandler = {
  source: "symbol",

  collectRequests(holdings: TransformedHolding[], date: Date) {
    const requests: SymbolRequest[] = [];
    for (const h of holdings) {
      if (h.source === "symbol" && h.symbol_id) {
        requests.push({ symbolId: h.symbol_id, date });
      }
    }
    return requests;
  },

  async fetchData(requests: SymbolRequest[], options?: { upsert?: boolean }) {
    if (requests.length === 0) return new Map();
    try {
      return await fetchQuotes(requests, options?.upsert);
    } catch {
      return new Map();
    }
  },

  getKey(holding: TransformedHolding, date: Date) {
    if (holding.source !== "symbol" || !holding.symbol_id) return null;
    return `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
