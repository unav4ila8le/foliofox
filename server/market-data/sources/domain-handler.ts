import { fetchDomainValuations } from "@/server/domain-valuations/fetch";
import { formatUTCDateKey } from "@/lib/date/date-utils";

import type {
  MarketDataHandler,
  DomainRequest,
  MarketDataPosition,
} from "./types";

export const domainHandler: MarketDataHandler = {
  source: "domain",

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
      return await fetchDomainValuations(requests, options?.upsert);
    } catch {
      return new Map();
    }
  },

  async fetchForPositionsRange(
    positions: MarketDataPosition[],
    dates: Date[],
    options?: { upsert?: boolean; eligibleDates?: Map<string, Set<string>> },
  ) {
    const requests: DomainRequest[] = [];
    const dedup = new Set<string>();

    for (const date of dates) {
      const dateKey = formatUTCDateKey(date);

      for (const position of positions) {
        if (!position.domain_id) continue;

        const allowedDates = options?.eligibleDates?.get(position.id ?? "");
        if (allowedDates && !allowedDates.has(dateKey)) continue;

        const dedupKey = `${position.domain_id}|${dateKey}`;
        if (dedup.has(dedupKey)) continue;
        dedup.add(dedupKey);

        requests.push({ domain: position.domain_id, date });
      }
    }

    if (requests.length === 0) return new Map();

    try {
      return await fetchDomainValuations(requests, options?.upsert);
    } catch {
      return new Map();
    }
  },

  getKey(position: MarketDataPosition, date: Date) {
    if (!position.domain_id) return null;
    return `${position.domain_id}|${formatUTCDateKey(date)}`;
  },
};
