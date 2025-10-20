import { format } from "date-fns";

import { fetchQuotes } from "@/server/quotes/fetch";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketDataHandler,
  SymbolRequest,
  MarketDataPosition,
} from "./types";

export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  async fetchExtensions(positionIds: string[], supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("source_symbols")
      .select("id, symbol_id")
      .in("id", positionIds);

    if (error) {
      throw new Error(`Failed to fetch symbol extensions: ${error.message}`);
    }

    const extensionMap = new Map<string, string>();
    data?.forEach((row) => {
      if (row.symbol_id) {
        extensionMap.set(row.id, row.symbol_id);
      }
    });

    return extensionMap;
  },

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
