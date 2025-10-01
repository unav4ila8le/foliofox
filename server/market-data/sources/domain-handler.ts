import { format } from "date-fns";

import { fetchDomainValuations } from "@/server/domain-valuations/fetch";

import type { TransformedHolding } from "@/types/global.types";
import type { DomainMarketDataHandler, DomainRequest } from "./types";

export const domainHandler: DomainMarketDataHandler = {
  source: "domain",

  collectRequests(holdings: TransformedHolding[], date: Date) {
    const requests: DomainRequest[] = [];
    for (const h of holdings) {
      if (h.source === "domain" && h.domain_id) {
        requests.push({ domain: h.domain_id, date });
      }
    }
    return requests;
  },

  async fetchData(requests: DomainRequest[], options?: { upsert?: boolean }) {
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
