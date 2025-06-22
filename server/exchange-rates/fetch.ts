"use server";

import { format } from "date-fns";

import { createClient } from "@/utils/supabase/server";

// Fetch a specific exchange rate from USD to target currency.
export async function fetchExchangeRate(
  targetCurrency: string,
  date: Date = new Date(),
) {
  // Check if target currency is USD
  if (targetCurrency === "USD") {
    return 1;
  }

  // Supabase client
  const supabase = await createClient();
  const dateString = format(date, "yyyy-MM-dd");

  // 1. Try to get the exchange rate for the exact date
  const { data: rate, error } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base_currency", "USD")
    .eq("target_currency", targetCurrency)
    .eq("date", dateString)
    .single();

  if (error || !rate) {
    // 2. Call the edge function to fetch and insert the missing rate
    const edgeUrl = `https://icnvjrvkdjtbnldhootf.supabase.co/functions/v1/fetch-exchange-rates?date=${dateString}`;
    const jwt = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const edgeResponse = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!edgeResponse.ok) {
      throw new Error(
        `Edge function failed: ${edgeResponse.status} ${edgeResponse.statusText}`,
      );
    }

    // 3. Query the database again for the exact date
    const { data: retryRate, error: retryError } = await supabase
      .from("exchange_rates")
      .select("rate")
      .eq("base_currency", "USD")
      .eq("target_currency", targetCurrency)
      .lte("date", dateString)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (!retryRate || retryError) {
      throw new Error(
        `No exchange rate found for ${targetCurrency} on ${dateString} after edge function call`,
      );
    }

    return retryRate.rate;
  }

  return rate.rate;
}

/**
 * Fetch multiple exchange rates for different currencies and dates in bulk.
 * Much more efficient than calling fetchExchangeRate() multiple times.
 *
 * @param requests - Array of {currency, date} pairs to fetch
 * @returns Map where key is "currency|date" and value is the rate
 */
export async function fetchMultipleExchangeRates(
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

  // Step 1: Check what's already cached in database
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

  // Step 2: Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  console.log(
    `💱 Bulk Exchange Rates: Found ${cachedRates?.length || 0} cached, need to fetch ${missingRequests.length}`,
  );

  // Step 3: Fetch missing rates using edge function
  if (missingRequests.length > 0) {
    console.log(`🌐 Fetching ${missingRequests.length} exchange rates...`);

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

    // Re-query database for the missing rates
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

    console.log(`✅ Bulk Exchange Rates: Successfully processed all requests`);
  }

  return results;
}

// 🧪 TEMPORARY: Test function for bulk exchange rates
export async function testBulkExchangeRates() {
  console.log("🧪 Testing bulk exchange rates...");

  const requests = [
    { currency: "USD", date: new Date("2024-01-01") }, // Should be instant (rate = 1)
    { currency: "EUR", date: new Date("2024-01-08") }, // Will need to fetch
    { currency: "GBP", date: new Date("2024-01-01") }, // Will need to fetch
    { currency: "EUR", date: new Date("2024-01-08") }, // Different date
    { currency: "USD", date: new Date("2024-01-02") }, // USD again (instant)
  ];

  const startTime = Date.now();
  const results = await fetchMultipleExchangeRates(requests);
  const endTime = Date.now();

  console.log("🧪 Bulk exchange rates results:");
  console.log(results);
  console.log(`🧪 Total time: ${endTime - startTime}ms`);
  console.log("🧪 Bulk exchange rates test completed!");
}
