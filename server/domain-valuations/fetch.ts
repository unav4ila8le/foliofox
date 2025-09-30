"use server";

import { format } from "date-fns";

import { createServiceClient } from "@/supabase/service";

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

/**
 * Fetch multiple domain valuations for different domains and dates in bulk.
 *
 * @param requests - Array of {domain, date} pairs to fetch
 * @param upsert - Whether to cache results in database (defaults to true)
 * @returns Map where key is "domain|date" and value is the valuation
 */
export async function fetchDomainValuations(
  requests: Array<{ domain: string; date: Date }>,
  upsert: boolean = true,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const results = new Map<string, number>();
  const supabase = createServiceClient();

  // Prepare cache queries for all requests
  const cacheQueries = requests.map(({ domain, date }) => ({
    domain,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${domain}|${format(date, "yyyy-MM-dd")}`,
  }));

  // 1. Check database cache
  const domains = [...new Set(cacheQueries.map((q) => q.domain))];
  const dateStrings = [...new Set(cacheQueries.map((q) => q.dateString))];

  const { data: cachedValuations } = await supabase
    .from("domain_valuations")
    .select("id, date, price")
    .in("id", domains)
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

    missingRequests.forEach(({ domain, dateString }) => {
      const existing = batchesByDate.get(dateString) || [];
      existing.push(domain);
      batchesByDate.set(dateString, existing);
    });

    const fetchPromises = Array.from(batchesByDate.entries()).map(
      async ([dateString, domains]) => {
        try {
          // Create batches of up to 2560 domains
          const batches = [];
          for (let i = 0; i < domains.length; i += 2560) {
            batches.push(domains.slice(i, i + 2560));
          }

          const batchResults = [];
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
                    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
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
          throw new Error(
            error instanceof Error
              ? `Failed to fetch domain valuations for date ${dateString}: ${error.message}`
              : `Failed to fetch domain valuations for date ${dateString}`,
          );
        }
      },
    );

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // 3. Process results and store in database
    const successfulFetches: {
      domain: string;
      dateString: string;
      price: number;
    }[] = [];

    fetchResults.forEach(({ dateString, valuations }) => {
      valuations.forEach((valuation: DomainValuation) => {
        if (valuation.domain && !valuation.error) {
          // Use brokerage price as the default valuation
          const price =
            valuation.brokerage || valuation.marketplace || valuation.auction;

          if (price && price > 0) {
            const cacheKey = `${valuation.domain}|${dateString}`;
            results.set(cacheKey, price);

            successfulFetches.push({
              domain: valuation.domain,
              dateString,
              price,
            });
          }
        }
      });
    });

    // 4. Store new valuations in database only if upsert is enabled
    if (upsert && successfulFetches.length > 0) {
      const { error: insertError } = await supabase
        .from("domain_valuations")
        .upsert(
          successfulFetches.map(({ domain, dateString, price }) => ({
            id: domain,
            date: dateString,
            price: price,
          })),
          { onConflict: "id,date" },
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
  const key = `${domain}|${format(date, "yyyy-MM-dd")}`;
  return valuations.get(key) || 0;
}
