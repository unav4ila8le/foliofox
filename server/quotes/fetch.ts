"use server";

import { addDays, compareAsc, format, parseISO, subDays } from "date-fns";
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

  const { data: cachedQuotes, error: cachedError } = await supabase
    .from("quotes")
    .select("symbol_id, date, price")
    .in("symbol_id", symbolIds)
    .in("date", dateStrings);

  if (cachedError) {
    console.error("[fetchQuotes] cache query error:", cachedError);
  } else {
    console.log(
      "[fetchQuotes] cache hits",
      cachedQuotes?.length ?? 0,
      "unique symbols",
      symbolIds.length,
      "unique dates",
      dateStrings.length,
    );
  }

  // Store cached results
  cachedQuotes?.forEach((quote) => {
    const cacheKey = `${quote.symbol_id}|${quote.date}`;
    results.set(cacheKey, quote.price);
  });

  // Find what's missing from cache
  const missingRequests = cacheQueries.filter(
    ({ cacheKey }) => !results.has(cacheKey),
  );

  // 2. Fetch missing quotes from Yahoo Finance grouped by symbol
  if (missingRequests.length > 0) {
    const sample = missingRequests.slice(0, 5);
    const missingBySymbol = new Map<string, number>();
    missingRequests.forEach(({ symbolId }) => {
      missingBySymbol.set(symbolId, (missingBySymbol.get(symbolId) ?? 0) + 1);
    });
    const topMissing = Array.from(missingBySymbol.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    console.log(
      "[fetchQuotes] missingRequests",
      missingRequests.length,
      sample.map(({ symbolId, dateString }) => `${symbolId}|${dateString}`),
      "top",
      topMissing,
    );

    const requestsBySymbol = new Map<string, Set<string>>();

    missingRequests.forEach(({ symbolId, dateString }) => {
      const existing = requestsBySymbol.get(symbolId);
      if (existing) {
        existing.add(dateString);
      } else {
        requestsBySymbol.set(symbolId, new Set([dateString]));
      }
    });

    const successfulFetches: Array<{
      symbolId: string;
      dateString: string;
      price: number;
      cacheKey: string;
    }> = [];

    for (const [symbolId, dateStringsSet] of requestsBySymbol.entries()) {
      const dateStringsSorted = Array.from(dateStringsSet).sort((a, b) =>
        compareAsc(parseISO(a), parseISO(b)),
      );

      if (!dateStringsSorted.length) continue;

      const earliest = parseISO(dateStringsSorted[0]);
      const latest = parseISO(dateStringsSorted[dateStringsSorted.length - 1]);

      const period1 = subDays(earliest, 7);
      const period2 = addDays(latest, 1);

      let chartData;
      try {
        chartData = await yahooFinance.chart(symbolId, {
          period1,
          period2,
          interval: "1d",
        });
      } catch (error) {
        console.warn(`Failed to fetch chart for ${symbolId}:`, error);
        continue;
      }

      const quoteEntries = (chartData?.quotes ?? [])
        .map((quote) => {
          const date = quote.date ? new Date(quote.date) : null;
          if (!date || Number.isNaN(date.getTime())) return null;

          const value = quote.adjclose ?? quote.close;
          if (!value || value <= 0) return null;

          return {
            dateKey: format(date, "yyyy-MM-dd"),
            price: Number(value),
          };
        })
        .filter(
          (
            entry,
          ): entry is { dateKey: string; price: number } => entry !== null,
        )
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      let pointer = 0;
      let lastPrice: number | null = null;

      for (const dateString of dateStringsSorted) {
        while (pointer < quoteEntries.length) {
          const entry = quoteEntries[pointer];
          if (!entry) {
            pointer += 1;
            continue;
          }

          if (entry.dateKey <= dateString) {
            lastPrice = entry.price;
            pointer += 1;
          } else {
            break;
          }
        }

        if (lastPrice == null) continue;

        const cacheKey = `${symbolId}|${dateString}`;
        results.set(cacheKey, lastPrice);
        successfulFetches.push({
          symbolId,
          dateString,
          price: lastPrice,
          cacheKey,
        });
      }
    }

    if (upsert && successfulFetches.length > 0) {
      const supabase = await createServiceClient();
      const { error: insertError } = await supabase
        .from("quotes")
        .upsert(
          successfulFetches.map(({ symbolId, dateString, price }) => ({
            symbol_id: symbolId,
            date: dateString,
            price,
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
