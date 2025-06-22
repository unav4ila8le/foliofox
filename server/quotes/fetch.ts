"use server";

import { format } from "date-fns";
import yahooFinance from "yahoo-finance2";

import { createClient } from "@/utils/supabase/server";

/**
 * Fetch a quote price for a symbol on a specific date.
 *
 * This function implements a caching strategy:
 * 1. First, try to get the quote from our database
 * 2. If not found, fetch from Yahoo Finance using the chart() method
 * 3. For historical dates, use the quotes array for accurate historical prices
 * 4. For current/future dates, fall back to regularMarketPrice when quotes is empty
 * 5. Cache the result in our database for future requests
 *
 * @param symbolId - The stock symbol (e.g., "AAPL", "BTC-USD")
 * @param date - The date to fetch the quote for (defaults to today)
 * @returns The price for the symbol on the given date
 */
export async function fetchQuote(symbolId: string, date: Date = new Date()) {
  const supabase = await createClient();
  const dateString = format(date, "yyyy-MM-dd");

  // 1. Try to get the quote from our database first
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("price")
    .eq("symbol_id", symbolId)
    .eq("date", dateString)
    .single();

  if (error || !quote) {
    // 2. Fetch from Yahoo Finance using chart method
    const chartData = await yahooFinance.chart(symbolId, {
      period1: dateString,
      interval: "1d",
    });

    if (!chartData) {
      throw new Error(`No chart data found for ${symbolId} on ${dateString}`);
    }

    let price;

    // Try to get price from quotes array first (for historical data)
    if (chartData.quotes && chartData.quotes.length > 0) {
      const latestQuote = chartData.quotes[chartData.quotes.length - 1];
      price = latestQuote.adjclose ?? latestQuote.close;
    }
    // If quotes array is empty, use regularMarketPrice from meta (for current/future dates)
    else if (chartData.meta && chartData.meta.regularMarketPrice) {
      price = chartData.meta.regularMarketPrice;
    }
    // No price data available
    else {
      throw new Error(
        `No price data available for ${symbolId} on ${dateString}`,
      );
    }

    if (!price || price <= 0) {
      throw new Error(
        `No valid price data available for ${symbolId} on ${dateString}`,
      );
    }

    // 3. Insert the quote in our database with conflict resolution
    const { error: insertError } = await supabase.from("quotes").upsert(
      {
        symbol_id: symbolId,
        date: dateString,
        price: price,
      },
      {
        onConflict: "symbol_id,date",
      },
    );

    if (insertError) {
      throw new Error(`Failed to insert quote: ${insertError.message}`);
    }

    return price;
  }

  // 4. Return cached quote from database
  return quote.price;
}

/**
 * Fetch multiple quotes for different symbols and dates in bulk.
 * Much more efficient than calling fetchQuote() multiple times.
 *
 * @param requests - Array of {symbolId, date} pairs to fetch
 * @returns Map where key is "symbolId|date" and value is the price
 */
export async function fetchMultipleQuotes(
  requests: Array<{ symbolId: string; date: Date }>,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const supabase = await createClient();
  const results = new Map<string, number>();

  // Step 1: Check what's already cached in database
  const cacheQueries = requests.map(({ symbolId, date }) => ({
    symbolId,
    dateString: format(date, "yyyy-MM-dd"),
    cacheKey: `${symbolId}|${format(date, "yyyy-MM-dd")}`,
  }));

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

  console.log(
    `📊 Bulk Quotes: Found ${cachedQuotes?.length || 0} cached, need to fetch ${requests.length - (cachedQuotes?.length || 0)}`,
  );

  // Step 2: Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // Step 3: Fetch missing quotes from Yahoo Finance in parallel
  if (missingRequests.length > 0) {
    console.log(
      `🌐 Fetching ${missingRequests.length} quotes from Yahoo Finance...`,
    );

    const fetchPromises = missingRequests.map(
      async ({ symbolId, dateString, cacheKey }) => {
        try {
          // Use the existing Yahoo Finance logic from fetchQuote
          const chartData = await yahooFinance.chart(symbolId, {
            period1: dateString,
            interval: "1d",
          });

          if (!chartData) {
            throw new Error(
              `No chart data found for ${symbolId} on ${dateString}`,
            );
          }

          let price;
          if (chartData.quotes && chartData.quotes.length > 0) {
            const latestQuote = chartData.quotes[chartData.quotes.length - 1];
            price = latestQuote.adjclose ?? latestQuote.close;
          } else if (chartData.meta && chartData.meta.regularMarketPrice) {
            price = chartData.meta.regularMarketPrice;
          } else {
            throw new Error(
              `No price data available for ${symbolId} on ${dateString}`,
            );
          }

          if (!price || price <= 0) {
            throw new Error(
              `No valid price data available for ${symbolId} on ${dateString}`,
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

    // Step 4: Store successful fetches in database and results
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

    console.log(
      `✅ Bulk Quotes: Successfully fetched ${successfulFetches.length}/${missingRequests.length} new quotes`,
    );
  }

  return results;
}
