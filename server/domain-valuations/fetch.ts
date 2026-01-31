"use server";

import { createServiceClient } from "@/supabase/service";
import { formatUTCDateKey } from "@/lib/date/date-utils";

// Replicate API configuration
const REPLICATE_API = "https://api.replicate.com/v1/predictions";
const MODEL_VERSION =
  "humbleworth/price-predict-v1:a925db842c707850e4ca7b7e86b217692b0353a9ca05eb028802c4a85db93843";

interface DomainValuation {
  domain: string;
  auction: number;
  marketplace: number;
  brokerage: number;
  error?: string | null;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

type DomainValuationCacheEntry = {
  dateKey: string;
  dateMs: number;
  price: number;
};

const toDateKey = (date: Date) => formatUTCDateKey(date);
const toDateMs = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00Z`).getTime();

async function fetchDomainValuationsFromReplicate(
  supabase: ServiceClient,
  domains: string[],
  dateKey: string,
  upsert: boolean,
) {
  const results = new Map<string, number>();

  if (!domains.length) return results;

  const batches: string[][] = [];
  for (let i = 0; i < domains.length; i += 2560) {
    batches.push(domains.slice(i, i + 2560));
  }

  for (const batch of batches) {
    const domainsInput = batch.join(",");

    const response = await fetch(REPLICATE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          domains: domainsInput,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const prediction = await response.json();

    let result = prediction;
    while (result.status === "starting" || result.status === "processing") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusResponse = await fetch(`${REPLICATE_API}/${result.id}`, {
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        },
      });
      result = await statusResponse.json();
    }

    if (result.status === "succeeded" && result.output?.valuations) {
      result.output.valuations.forEach((valuation: DomainValuation) => {
        if (!valuation.domain || valuation.error) return;
        const price =
          valuation.brokerage || valuation.marketplace || valuation.auction;
        if (price && price > 0) {
          results.set(valuation.domain, price);
        }
      });
    }
  }

  if (upsert && results.size > 0) {
    const rows = Array.from(results.entries()).map(([domain, price]) => ({
      id: domain,
      date: dateKey,
      price,
    }));

    const { error: insertError } = await supabase
      .from("domain_valuations")
      .upsert(rows, { onConflict: "id,date" });

    if (insertError) {
      console.error("Failed to bulk insert domain valuations:", insertError);
    }
  }

  return results;
}

function findClosestValuation(
  entries: DomainValuationCacheEntry[],
  targetMs: number,
): DomainValuationCacheEntry | null {
  if (!entries.length) return null;

  let closest = entries[0];
  let closestDiff = Math.abs(closest.dateMs - targetMs);

  for (let i = 1; i < entries.length; i += 1) {
    const entry = entries[i];
    const diff = Math.abs(entry.dateMs - targetMs);
    if (diff < closestDiff) {
      closest = entry;
      closestDiff = diff;
    }
  }

  return closest;
}

/**
 * Fetch domain valuations for requested dates.
 * Exact cache matches are used when available. Missing dates fall back to:
 * - Today: fetch from Replicate and cache the result.
 * - Past/Future: use the closest cached valuation.
 */
export async function fetchDomainValuations(
  requests: Array<{ domain: string; date: Date }>,
  upsert: boolean = true,
) {
  if (!requests.length) return new Map();

  const results = new Map<string, number>();
  const supabase = createServiceClient();
  const todayKey = toDateKey(new Date());

  const normalizedRequests = requests.map((request) => {
    const dateKey = toDateKey(request.date);
    return {
      domain: request.domain,
      dateKey,
      cacheKey: `${request.domain}|${dateKey}`,
    };
  });

  const domains = Array.from(
    new Set(normalizedRequests.map((request) => request.domain)),
  );
  const dateKeys = Array.from(
    new Set(normalizedRequests.map((request) => request.dateKey)),
  );

  if (!domains.length) return results;

  const { data: cachedExact, error: cachedExactError } = await supabase
    .from("domain_valuations")
    .select("id, date, price")
    .in("id", domains)
    .in("date", dateKeys);

  if (cachedExactError) {
    console.error(
      "[fetchDomainValuations] cache query error:",
      cachedExactError,
    );
  }

  cachedExact?.forEach((valuation) => {
    results.set(`${valuation.id}|${valuation.date}`, valuation.price);
  });

  const missingRequests = normalizedRequests.filter(
    (request) => !results.has(request.cacheKey),
  );

  if (!missingRequests.length) return results;

  const missingTodayDomains = Array.from(
    new Set(
      missingRequests
        .filter((request) => request.dateKey === todayKey)
        .map((request) => request.domain),
    ),
  );

  let fetchedTodayByDomain = new Map<string, number>();
  if (missingTodayDomains.length > 0) {
    fetchedTodayByDomain = await fetchDomainValuationsFromReplicate(
      supabase,
      missingTodayDomains,
      todayKey,
      upsert,
    );

    fetchedTodayByDomain.forEach((price, domain) => {
      results.set(`${domain}|${todayKey}`, price);
    });
  }

  const remainingRequests = missingRequests.filter(
    (request) => !results.has(request.cacheKey),
  );
  const pastRequests = remainingRequests.filter(
    (request) => request.dateKey !== todayKey,
  );

  if (!pastRequests.length) return results;

  const domainsForClosest = Array.from(
    new Set(pastRequests.map((request) => request.domain)),
  );

  const { data: cachedAll, error: cachedAllError } = await supabase
    .from("domain_valuations")
    .select("id, date, price")
    .in("id", domainsForClosest);

  if (cachedAllError) {
    console.error(
      "[fetchDomainValuations] closest cache query error:",
      cachedAllError,
    );
  }

  const valuationsByDomain = new Map<string, DomainValuationCacheEntry[]>();

  cachedAll?.forEach((valuation) => {
    const list = valuationsByDomain.get(valuation.id) || [];
    list.push({
      dateKey: valuation.date,
      dateMs: toDateMs(valuation.date),
      price: valuation.price,
    });
    valuationsByDomain.set(valuation.id, list);
  });

  if (fetchedTodayByDomain.size > 0) {
    fetchedTodayByDomain.forEach((price, domain) => {
      const list = valuationsByDomain.get(domain) || [];
      if (!list.some((entry) => entry.dateKey === todayKey)) {
        list.push({
          dateKey: todayKey,
          dateMs: toDateMs(todayKey),
          price,
        });
      }
      valuationsByDomain.set(domain, list);
    });
  }

  valuationsByDomain.forEach((list) => {
    list.sort((a, b) => a.dateMs - b.dateMs);
  });

  for (const request of pastRequests) {
    const list = valuationsByDomain.get(request.domain);
    if (!list?.length) continue;

    const closest = findClosestValuation(list, toDateMs(request.dateKey));
    if (!closest) continue;

    results.set(request.cacheKey, closest.price);
  }

  return results;
}

/**
 * Fetch a single domain valuation for a specific domain and date.
 *
 * @param domain - The domain to fetch the valuation for
 * @param options - Optional configuration
 * @returns The domain valuation
 */
export async function fetchSingleDomainValuation(
  domain: string,
  options: {
    date?: Date;
    upsert?: boolean;
  } = {},
): Promise<number> {
  const { date = new Date(), upsert = true } = options;

  const valuations = await fetchDomainValuations([{ domain, date }], upsert);
  const key = `${domain}|${formatUTCDateKey(date)}`;
  return valuations.get(key) || 0;
}
