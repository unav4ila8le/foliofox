"use server";

import { format } from "date-fns";

import { createServiceClient } from "@/supabase/service";

// Replicate API configuration
const REPLICATE_API = "https://api.replicate.com/v1/predictions";
const MODEL_VERSION = "humbleworth/price-predict-v1";

interface DomainValuation {
  domain: string;
  auction: number;
  marketplace: number;
  brokerage: number;
  error?: string | null;
}

/**
 * Fetch multiple domain valuations for different domains and dates in bulk.
 *
 * @param requests - Array of {domainId, date} pairs to fetch
 * @returns Map where key is "domainId|date" and value is the valuation
 */
export async function fetchDomainValuations(
  requests: Array<{ domainId: string; date: Date }>,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const results = new Map<string, number>();
  const supabase = createServiceClient();

  // Prepare cache queries for all requests
  const cacheQueries = requests.map(({ domainId, date }) => ({
    domainId,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${domainId}|${format(date, "yyyy-MM-dd")}`,
  }));

  // 1. Check database cache
  const domainIds = [...new Set(cacheQueries.map((q) => q.domainId))];
  const dateStrings = [...new Set(cacheQueries.map((q) => q.dateString))];

  const { data: cachedValuations } = await supabase
    .from("domain_valuations")
    .select("id, date, price")
    .in("id", domainIds)
    .in("date", dateStrings);

  // Store cached results
  cachedValuations?.forEach((valuation) => {
    const cacheKey = `${valuation.id}|${valuation.date}`;
    results.set(cacheKey, valuation.price);
  });

  // Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // 2. Fetch missing valuations from API in batches
  if (missingRequests.length > 0) {
    // Group domains by date for batching
    const batchesByDate = new Map<string, string[]>();

    missingRequests.forEach(({ domainId, dateString }) => {
      const existing = batchesByDate.get(dateString) || [];
      existing.push(domainId);
      batchesByDate.set(dateString, existing);
    });

    const fetchPromises = Array.from(batchesByDate.entries()).map(
      async ([dateString, domainIds]) => {
        try {
          // Create batches of up to 2560 domains
          const batches = [];
          for (let i = 0; i < domainIds.length; i += 2560) {
            batches.push(domainIds.slice(i, i + 2560));
          }

          const batchResults = [];
          for (const batch of batches) {
            const domainsInput = batch.join(",");

            const response = await fetch(REPLICATE_API, {
              method: "POST",
              headers: {
                Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                version: MODEL_VERSION,
                input: {
                  domains: domainsInput,
                },
              }),
            });

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`,
              );
            }

            const prediction = await response.json();

            // Wait for prediction to complete (API runs async)
            let result = prediction;
            while (
              result.status === "starting" ||
              result.status === "processing"
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const statusResponse = await fetch(
                `${REPLICATE_API}/${result.id}`,
                {
                  headers: {
                    Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
                  },
                },
              );
              result = await statusResponse.json();
            }

            if (result.status === "succeeded" && result.output?.valuations) {
              batchResults.push(...result.output.valuations);
            }
          }

          return { dateString, valuations: batchResults };
        } catch (error) {
          console.warn(
            `Failed to fetch valuations for date ${dateString}:`,
            error,
          );
          return { dateString, valuations: [] };
        }
      },
    );

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // 3. Process results and store in database
    const successfulFetches: {
      domainId: string;
      dateString: string;
      price: number;
    }[] = [];

    fetchResults.forEach(({ dateString, valuations }) => {
      valuations.forEach((valuation: DomainValuation) => {
        if (valuation.domain && !valuation.error) {
          // Use marketplace price as the default valuation
          const price =
            valuation.marketplace || valuation.brokerage || valuation.auction;

          if (price && price > 0) {
            const cacheKey = `${valuation.domain}|${dateString}`;
            results.set(cacheKey, price);

            successfulFetches.push({
              domainId: valuation.domain,
              dateString,
              price,
            });
          }
        }
      });
    });

    // 4. Store new valuations in database
    if (successfulFetches.length > 0) {
      const { error: insertError } = await supabase
        .from("domain_valuations")
        .upsert(
          successfulFetches.map(({ domainId, dateString, price }) => ({
            domain_id: domainId,
            date: dateString,
            price: price,
          })),
          { onConflict: "domain_id,date" },
        );

      if (insertError) {
        console.error("Failed to bulk insert domain valuations:", insertError);
      }
    }
  }

  return results;
}

/**
 * Fetch a single domain valuation for a specific domain and date.
 *
 * @param domainId - The domain to fetch the valuation for
 * @param options - Optional configuration
 * @returns The domain valuation
 */
export async function fetchSingleDomainValuation(
  domainId: string,
  options: {
    date?: Date;
  } = {},
): Promise<number> {
  const { date = new Date() } = options;

  const valuations = await fetchDomainValuations([{ domainId, date }]);
  const key = `${domainId}|${format(date, "yyyy-MM-dd")}`;
  return valuations.get(key) || 0;
}
