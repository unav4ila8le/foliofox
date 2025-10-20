import { format } from "date-fns";

import { fetchDomainValuations } from "@/server/domain-valuations/fetch";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketDataHandler,
  DomainRequest,
  MarketDataPosition,
} from "./types";

export const domainHandler: MarketDataHandler = {
  source: "domain",

  async fetchExtensions(positionIds: string[], supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("source_domains")
      .select("id, domain_id")
      .in("id", positionIds);

    if (error) {
      throw new Error(`Failed to fetch domain extensions: ${error.message}`);
    }

    const extensionMap = new Map<string, string>();
    data?.forEach((row) => {
      if (row.domain_id) {
        extensionMap.set(row.id, row.domain_id);
      }
    });

    return extensionMap;
  },

  async fetchForPositions(
    positions: MarketDataPosition[],
    date: Date,
    options?: { upsert?: boolean },
  ) {
    // Collect requests for domain positions
    const requests: DomainRequest[] = [];
    for (const p of positions) {
      if (p.domain_id) {
        requests.push({ domain: p.domain_id, date });
      }
    }

    // Fetch valuations if we have any requests
    if (requests.length === 0) return new Map();

    try {
      return await fetchDomainValuations(requests, options?.upsert ?? true);
    } catch {
      return new Map();
    }
  },

  getKey(position: MarketDataPosition, date: Date) {
    if (!position.domain_id) return null;
    return `${position.domain_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
