import { format } from "date-fns";

import { fetchDomainValuations } from "@/server/domain-valuations/fetch";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransformedHolding } from "@/types/global.types";
import type { MarketDataHandler, DomainRequest } from "./types";

export const domainHandler: MarketDataHandler = {
  source: "domain",

  async fetchExtensions(holdingIds: string[], supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("domain_holdings")
      .select("holding_id, domain_id")
      .in("holding_id", holdingIds);

    if (error) {
      throw new Error(`Failed to fetch domain extensions: ${error.message}`);
    }

    const extensionMap = new Map<string, string>();
    data?.forEach((row) => {
      if (row.domain_id) {
        extensionMap.set(row.holding_id, row.domain_id);
      }
    });

    return extensionMap;
  },

  async fetchForHoldings(
    holdings: TransformedHolding[],
    date: Date,
    options?: { upsert?: boolean },
  ) {
    // Collect requests for domain holdings
    const requests: DomainRequest[] = [];
    for (const h of holdings) {
      if (h.source === "domain" && h.domain_id) {
        requests.push({ domain: h.domain_id, date });
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

  getKey(holding: TransformedHolding, date: Date) {
    if (holding.source !== "domain" || !holding.domain_id) return null;
    return `${holding.domain_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
