"use server";

import { format, subDays } from "date-fns";
import YahooFinance from "yahoo-finance2";

import { createServiceClient } from "@/utils/supabase/service";

// Initialize yahooFinance with v3 pattern
const yahooFinance = new YahooFinance();

/**
 * Fetch multiple quotes for different symbols and dates in bulk.
 *
 * @param requests - Array of {symbolId, date} pairs to fetch
 * @returns Map where key is "symbolId|date" and value is the price
 */
export async function fetchQuotes(
  requests: Array<{ symbolId: string; date: Date }>,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const supabase = await createServiceClient();
  const results = new Map<string, number>();

  // 1. Check what's already cached in database
  const cacheQueries = requests.map(({ symbolId, date }) => ({
    symbolId,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${symbolId}|${format(date, "yyyy-MM-dd")}`,
  }));

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

  // 2. Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // 3. Fetch missing quotes from Yahoo Finance in parallel
  if (missingRequests.length > 0) {
    const fetchPromises = missingRequests.map(
      async ({ symbolId, dateString, cacheKey }) => {
        try {
          // First try to get data for the exact date
          let chartData = await yahooFinance.chart(symbolId, {
            period1: subDays(dateString, 1),
            period2: dateString,
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
              period1: subDays(dateString, 7),
              period2: dateString,
              interval: "1d",
            });
          }

          if (!chartData) {
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

    // 4. Store successful fetches in database and results
    const successfulFetches = fetchResults.filter((result) => result !== null);

    if (successfulFetches.length > 0) {
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

      // Add to results
      successfulFetches.forEach(({ cacheKey, price }) => {
        results.set(cacheKey, price);
      });
    }
  }

  return results;
}

/**
 * Fetch a single quote for a specific symbol and date.
 *
 * @param symbolId - The symbol to fetch the quote for
 * @param date - The date to fetch the quote for
 * @returns The quote price
 */
export async function fetchSingleQuote(
  symbolId: string,
  date: Date = new Date(),
): Promise<number> {
  const quotes = await fetchQuotes([{ symbolId, date }]);
  const key = `${symbolId}|${format(date, "yyyy-MM-dd")}`;
  return quotes.get(key) || 0;
}
