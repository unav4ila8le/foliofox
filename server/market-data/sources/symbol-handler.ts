import { format } from "date-fns";

import { fetchQuotes } from "@/server/quotes/fetch";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransformedHolding } from "@/types/global.types";
import type { MarketDataHandler, SymbolRequest } from "./types";

export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  async fetchExtensions(holdingIds: string[], supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("symbol_holdings")
      .select("holding_id, symbol_id")
      .in("holding_id", holdingIds);

    if (error) {
      throw new Error(`Failed to fetch symbol extensions: ${error.message}`);
    }

    const extensionMap = new Map<string, string>();
    data?.forEach((row) => {
      if (row.symbol_id) {
        extensionMap.set(row.holding_id, row.symbol_id);
      }
    });

    return extensionMap;
  },

  async fetchForHoldings(
    holdings: TransformedHolding[],
    date: Date,
    options?: { upsert?: boolean },
  ) {
    // Collect requests for symbol holdings
    const requests: SymbolRequest[] = [];
    for (const h of holdings) {
      if (h.source === "symbol" && h.symbol_id) {
        requests.push({ symbolId: h.symbol_id, date });
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

  getKey(holding: TransformedHolding, date: Date) {
    if (holding.source !== "symbol" || !holding.symbol_id) return null;
    return `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
