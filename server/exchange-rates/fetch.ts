"use server";

import { format } from "date-fns";

import { createServiceClient } from "@/utils/supabase/service";

// Exchange rate API
const FRANKFURTER_API = "https://api.frankfurter.app";

/**
 * Fetch multiple exchange rates for different currencies and dates in bulk.
 *
 * @param requests - Array of {currency, date} pairs to fetch
 * @returns Map where key is "currency|date" and value is the rate
 */
export async function fetchExchangeRates(
  requests: Array<{ currency: string; date: Date }>,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const results = new Map<string, number>();

  // Handle USD requests immediately (rate = 1)
  const nonUsdRequests = requests.filter((req) => {
    const cacheKey = `${req.currency}|${format(req.date, "yyyy-MM-dd")}`;
    if (req.currency === "USD") {
      results.set(cacheKey, 1);
      return false;
    }
    return true;
  });

  if (nonUsdRequests.length === 0) return results;

  const supabase = createServiceClient();

  // 1. Check what's already cached in database
  const cacheQueries = nonUsdRequests.map(({ currency, date }) => ({
    currency,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${currency}|${format(date, "yyyy-MM-dd")}`,
  }));

  // Get unique currencies and dates for efficient query
  const currencies = [...new Set(cacheQueries.map((q) => q.currency))];
  const dateStrings = [...new Set(cacheQueries.map((q) => q.dateString))];

  const { data: cachedRates } = await supabase
    .from("exchange_rates")
    .select("target_currency, date, rate")
    .eq("base_currency", "USD")
    .in("target_currency", currencies)
    .in("date", dateStrings);

  // Store cached results
  cachedRates?.forEach((rate) => {
    const cacheKey = `${rate.target_currency}|${rate.date}`;
    results.set(cacheKey, rate.rate);
  });

  // 2. Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // 3. Fetch missing rates using frankfurter api in parallel
  if (missingRequests.length > 0) {
    // Group by unique dates for frankfurter api calls
    const uniqueDates = [...new Set(missingRequests.map((r) => r.dateString))];

    // Create parallel promises for each date
    const fetchPromises = uniqueDates.map(async (dateString) => {
      try {
        const missingCurrenciesForDate = missingRequests
          .filter((req) => req.dateString === dateString)
          .map((req) => req.currency);

        const response = await fetch(
          `${FRANKFURTER_API}/${dateString}?base=USD&symbols=${missingCurrenciesForDate.join(",")}`,
        );
        const data = await response.json();

        if (!data.rates) {
          throw new Error(`No rates data found for ${dateString}`);
        }

        // Return the data for this date
        return {
          dateString,
          rates: data.rates,
          success: true,
        };
      } catch (error) {
        console.warn(
          `Failed to fetch exchange rates for ${dateString}:`,
          error,
        );
        return { dateString, success: false };
      }
    });

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // Filter successful fetches and prepare for bulk insert
    const successfulFetches = fetchResults.filter((result) => result.success);

    if (successfulFetches.length > 0) {
      // Prepare all rows for bulk insert
      const allRows = successfulFetches.flatMap(({ dateString, rates }) =>
        Object.entries(rates).map(([currency, rate]) => ({
          base_currency: "USD",
          target_currency: currency,
          rate: Number(rate),
          date: dateString,
        })),
      );

      // Single bulk insert into database
      const { error: insertError } = await supabase
        .from("exchange_rates")
        .upsert(allRows, { onConflict: "base_currency,target_currency,date" });

      if (insertError) {
        console.error("Failed to bulk insert exchange rates:", insertError);
      }

      // Add to results directly (no re-querying database!)
      allRows.forEach(({ target_currency, date, rate }) => {
        const cacheKey = `${target_currency}|${date}`;
        results.set(cacheKey, rate);
      });
    }
  }

  return results;
}

/**
 * Fetch a single exchange rate for a specific currency and date.
 *
 * @param currency - The currency to fetch the rate for
 * @param date - The date to fetch the rate for
 * @returns The exchange rate
 */
export async function fetchSingleExchangeRate(
  currency: string,
  date: Date = new Date(),
) {
  const rates = await fetchExchangeRates([{ currency, date }]);
  const key = `${currency}|${format(date, "yyyy-MM-dd")}`;
  return rates.get(key) || 1;
}
