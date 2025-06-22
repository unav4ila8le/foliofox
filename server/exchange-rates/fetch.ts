"use server";

import { format } from "date-fns";

import { createClient } from "@/utils/supabase/server";

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

  const supabase = await createClient();

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

  // 3. Fetch missing rates using edge function
  if (missingRequests.length > 0) {
    // Group by unique dates for edge function calls
    const uniqueDates = [...new Set(missingRequests.map((r) => r.dateString))];

    for (const dateString of uniqueDates) {
      try {
        const edgeUrl = `https://icnvjrvkdjtbnldhootf.supabase.co/functions/v1/fetch-exchange-rates?date=${dateString}`;
        const jwt = process.env.SUPABASE_SERVICE_ROLE_KEY;

        await fetch(edgeUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.warn(
          `Failed to fetch exchange rates for ${dateString}:`,
          error,
        );
      }
    }

    // 4. Re-query database for the missing rates
    const { data: newRates } = await supabase
      .from("exchange_rates")
      .select("target_currency, date, rate")
      .eq("base_currency", "USD")
      .in("target_currency", currencies)
      .in("date", dateStrings);

    // Add new rates to results
    newRates?.forEach((rate) => {
      const cacheKey = `${rate.target_currency}|${rate.date}`;
      if (!results.has(cacheKey)) {
        results.set(cacheKey, rate.rate);
      }
    });
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
