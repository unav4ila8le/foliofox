"use server";

import { addDays, format, subDays } from "date-fns";
import YahooFinance from "yahoo-finance2";

import { createServiceClient } from "@/supabase/service";

// Initialize yahooFinance with v3 pattern
const yahooFinance = new YahooFinance();

/**
 * Fetch multiple quotes for different symbols and dates in bulk.
 *
 * @param requests - Array of {symbolId, date} pairs to fetch
 * @param upsert - Whether to cache results in database (defaults to true)
 * @returns Map where key is "symbolId|date" and value is the price
 */
export async function fetchQuotes(
  requests: Array<{ symbolId: string; date: Date }>,
  upsert: boolean = true,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const results = new Map<string, number>();

  // Prepare cache queries for all requests
  const cacheQueries = requests.map(({ symbolId, date }) => ({
    symbolId,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${symbolId}|${format(date, "yyyy-MM-dd")}`,
  }));

  // 1. Always check database cache
  const supabase = await createServiceClient();

  // Get unique symbolIds and dateStrings for efficient query
  const symbolIds = [...new Set(cacheQueries.map((q) => q.symbolId))];
  const dateStrings = [...new Set(cacheQueries.map((q) => q.dateString))];

  const { data: cachedQuotes } = await supabase
    .from("quotes")
    .select("symbol_id, date, price")
    .in("symbol_id", symbolIds)
    .in("date", dateStrings);

  // Store cached results
  cachedQuotes?.forEach((quote) => {
    const cacheKey = `${quote.symbol_id}|${quote.date}`;
    results.set(cacheKey, quote.price);
  });

  // Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // 2. Fetch missing quotes from Yahoo Finance in parallel
  if (missingRequests.length > 0) {
    const fetchPromises = missingRequests.map(
      async ({ symbolId, dateString, cacheKey }) => {
        try {
          // First try to get data for the exact date
          const target = new Date(dateString);
          const period2 = addDays(target, 1);

          let chartData = await yahooFinance.chart(symbolId, {
            period1: subDays(period2, 1),
            period2,
            interval: "1d",
          });

          // If no data for exact date (weekend/holiday), extend the range
          if (
            !chartData ||
            !chartData.quotes ||
            chartData.quotes.length === 0
          ) {
            // Go back up to 7 days to find the closest trading day
            chartData = await yahooFinance.chart(symbolId, {
              period1: subDays(period2, 7),
              period2,
              interval: "1d",
            });
          }

          if (
            !chartData ||
            !chartData.quotes ||
            chartData.quotes.length === 0
          ) {
            throw new Error(
              `No chart data found for ${symbolId} on ${dateString}`,
            );
          }

          // Use the most recent available data (closest trading day)
          const latestQuote = chartData.quotes[chartData.quotes.length - 1];
          const price = latestQuote.adjclose ?? latestQuote.close;

          if (!price || price <= 0) {
            throw new Error(
              `No valid price data available for ${symbolId} around ${dateString}`,
            );
          }

          return { symbolId, dateString, price, cacheKey };
        } catch (error) {
          console.warn(
            `Failed to fetch quote for ${symbolId} on ${dateString}:`,
            error,
          );
          return null; // Return null for failed fetches
        }
      },
    );

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // 3. Store successful fetches in results (always) and in database if upsert is enabled
    const successfulFetches = [];
    // Remove duplicates
    const seen = new Set<string>();
    for (const result of fetchResults) {
      if (result) {
        const key = `${result.symbolId}|${result.dateString}`;
        if (!seen.has(key)) {
          seen.add(key);
          successfulFetches.push(result);
        }
      }
    }

    // Add to results
    successfulFetches.forEach(({ cacheKey, price }) => {
      results.set(cacheKey, price);
    });

    // 4. Upsert to database only if enabled
    if (upsert && successfulFetches.length > 0) {
      const supabase = await createServiceClient();
      // Bulk insert into database
      const { error: insertError } = await supabase.from("quotes").upsert(
        successfulFetches.map(({ symbolId, dateString, price }) => ({
          symbol_id: symbolId,
          date: dateString,
          price: price,
        })),
        { onConflict: "symbol_id,date" },
      );

      if (insertError) {
        console.error("Failed to bulk insert quotes:", insertError);
      }
    }
  }

  return results;
}

/**
 * Fetch a single quote for a specific symbol and date.
 *
 * @param symbolId - The symbol to fetch the quote for
 * @param options - Optional configuration
 * @returns The quote price
 */
export async function fetchSingleQuote(
  symbolId: string,
  options: {
    date?: Date;
    upsert?: boolean;
  } = {},
): Promise<number> {
  const { date = new Date(), upsert = true } = options;

  const quotes = await fetchQuotes([{ symbolId, date }], upsert);
  const key = `${symbolId}|${format(date, "yyyy-MM-dd")}`;
  return quotes.get(key) || 0;
}
