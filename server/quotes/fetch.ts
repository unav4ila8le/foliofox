"use server";

import { addDays, compareAsc, subDays } from "date-fns";

import { formatUtcDateKey, parseUtcDateKey } from "@/lib/date/date-utils";
import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import {
  resolveSymbolInput,
  resolveSymbolsBatch,
} from "@/server/symbols/resolve";
import { chunkArray, normalizeChartQuoteEntries } from "./utils";

/**
 * Fetch multiple quotes for different symbols and dates in bulk.
 *
 * @param requests - Array of {symbolLookup, date} pairs to fetch
 * @param upsert - Whether to cache results in database (defaults to true)
 * @returns Map where key is "canonicalSymbolId|date" and value is the price
 */
export async function fetchQuotes(
  requests: Array<{ symbolLookup: string; date: Date }>,
  upsert: boolean = true,
) {
  // Early return if no requests
  if (!requests.length) return new Map();

  const results = new Map<string, number>();

  // 1) Batch resolve all unique symbol identifiers
  const uniqueLookups = [...new Set(requests.map((r) => r.symbolLookup))];
  const { byInput, byCanonicalId } = await resolveSymbolsBatch(uniqueLookups, {
    provider: "yahoo",
    providerType: "ticker",
    onError: "throw",
  });

  // 2) Map requests to normalized format with resolutions
  const normalizedRequests = requests.map(({ symbolLookup, date }) => {
    const resolution = byInput.get(symbolLookup);
    if (!resolution) {
      throw new Error(
        `Unable to resolve symbol identifier "${symbolLookup}" to a canonical symbol.`,
      );
    }

    const dateString = formatUtcDateKey(date);

    return {
      inputLookup: symbolLookup,
      canonicalId: resolution.canonicalId,
      dateString,
      cacheKey: `${resolution.canonicalId}|${dateString}`,
    };
  });

  // 1. Always check database cache
  const supabase = await createServiceClient();

  // Get unique symbolIds and dateStrings for efficient query
  const symbolIds = [
    ...new Set(normalizedRequests.map((request) => request.canonicalId)),
  ];
  const dateStrings = [
    ...new Set(normalizedRequests.map((request) => request.dateString)),
  ];

  // Chunk Supabase lookups to stay comfortably under Supabase's 1k row limit
  const MAX_ROWS_PER_QUERY = 900;
  const baseChunkSize = Math.max(1, Math.floor(Math.sqrt(MAX_ROWS_PER_QUERY)));
  const symbolChunkSize = Math.max(
    1,
    Math.min(symbolIds.length, baseChunkSize),
  );
  const dateChunkSize = Math.max(
    1,
    Math.min(dateStrings.length, baseChunkSize),
  );

  const cachedQuotes: Array<{
    symbol_id: string;
    date: string;
    price: number;
  }> = [];

  for (const symbolChunk of chunkArray(symbolIds, symbolChunkSize)) {
    for (const dateChunk of chunkArray(dateStrings, dateChunkSize)) {
      const { data, error } = await supabase
        .from("quotes")
        .select("symbol_id, date, price")
        .in("symbol_id", symbolChunk)
        .in("date", dateChunk);

      if (error) {
        console.error("[fetchQuotes] cache query error:", error);
        continue;
      }

      if (data?.length) {
        cachedQuotes.push(...data);
      }
    }
  }

  // Store cached results
  cachedQuotes.forEach((quote) => {
    const cacheKey = `${quote.symbol_id}|${quote.date}`;
    results.set(cacheKey, quote.price);
  });

  // Find what's missing from cache
  const missingRequests = normalizedRequests.filter(
    ({ canonicalId, dateString }) =>
      !results.has(`${canonicalId}|${dateString}`),
  );

  // 2. Fetch missing quotes from Yahoo Finance grouped by symbol
  if (missingRequests.length > 0) {
    // Group requested calendar days per symbol so we can batch chart calls
    const requestsBySymbol = new Map<string, Set<string>>();
    for (const { canonicalId, dateString } of missingRequests) {
      const set = requestsBySymbol.get(canonicalId) ?? new Set();
      set.add(dateString);
      requestsBySymbol.set(canonicalId, set);
    }

    const successfulFetches: Array<{
      symbolId: string;
      dateString: string;
      price: number;
      cacheKey: string;
    }> = [];

    // Track symbol health: last available quote date per symbol
    const healthUpdates: Array<{ id: string; last_quote_at: string }> = [];

    for (const [symbolId, dateStringsSet] of requestsBySymbol.entries()) {
      const dateStringsSorted = Array.from(dateStringsSet).sort((a, b) =>
        compareAsc(parseUtcDateKey(a), parseUtcDateKey(b)),
      );

      if (!dateStringsSorted.length) continue;

      const earliest = parseUtcDateKey(dateStringsSorted[0]);
      const latest = parseUtcDateKey(
        dateStringsSorted[dateStringsSorted.length - 1],
      );

      // Include a small buffer before the earliest request so we can
      // reuse the prior trading day's quote if the first calendar day
      // falls on a weekend or holiday. Yahoo's chart API treats period2
      // as exclusive, so we add one day after the latest request.
      const bufferedStart = subDays(earliest, 7);
      const periodEndExclusive = addDays(latest, 1);

      let chartData;
      const resolution = byCanonicalId.get(symbolId);
      const ticker = resolution?.providerAlias;
      if (!ticker) {
        console.warn(
          `Skipping quote fetch for symbol ${symbolId}: missing Yahoo ticker alias.`,
        );
        continue;
      }

      try {
        chartData = await yahooFinance.chart(ticker, {
          period1: bufferedStart,
          period2: periodEndExclusive,
          interval: "1d",
        });
      } catch (error) {
        console.warn(
          `Failed to fetch chart for ${symbolId} (${ticker}):`,
          error,
        );
        chartData = null;
      }

      // Normalize chart quotes into sortable { dateKey, price } tuples
      const quoteEntries = normalizeChartQuoteEntries(chartData);

      let pointer = 0;
      let lastPrice: number | null = null;
      const requestedSet = new Set(dateStringsSorted);

      // Walk chronologically and reuse the latest available trade price
      for (const dateString of dateStringsSorted) {
        while (pointer < quoteEntries.length) {
          const entry = quoteEntries[pointer];
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

      // Final safety net: fallback to realtime quote when chart feed is empty
      if (!successfulFetches.some((entry) => entry.symbolId === symbolId)) {
        const fallbackPrice = chartData?.meta?.regularMarketPrice;
        const fallbackTime = chartData?.meta?.regularMarketTime;

        if (
          fallbackPrice &&
          fallbackPrice > 0 &&
          fallbackTime instanceof Date
        ) {
          const marketDateKey = formatUtcDateKey(fallbackTime);
          const fallbackDateKey = requestedSet.has(marketDateKey)
            ? marketDateKey
            : dateStringsSorted.at(-1)!;

          const cacheKey = `${symbolId}|${fallbackDateKey}`;
          results.set(cacheKey, fallbackPrice);
          successfulFetches.push({
            symbolId,
            dateString: fallbackDateKey,
            price: fallbackPrice,
            cacheKey,
          });
        }
      }

      // Track symbol health: use last chart quote date, fallback to regularMarketTime
      if (upsert) {
        const lastQuoteEntry = quoteEntries.at(-1);
        const lastQuoteAt = lastQuoteEntry
          ? new Date(`${lastQuoteEntry.dateKey}T00:00:00Z`)
          : chartData?.meta?.regularMarketTime instanceof Date
            ? chartData.meta.regularMarketTime
            : null;

        if (lastQuoteAt) {
          healthUpdates.push({
            id: symbolId,
            last_quote_at: lastQuoteAt.toISOString(),
          });
        }
      }
    }

    if (upsert && successfulFetches.length > 0) {
      // Sort by PK components to take locks in a stable order
      successfulFetches.sort((a, b) => {
        if (a.symbolId === b.symbolId) {
          return a.dateString.localeCompare(b.dateString);
        }
        return a.symbolId.localeCompare(b.symbolId);
      });

      const { error: insertError } = await supabase.from("quotes").upsert(
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

    // Update symbol health tracking with last available quote dates
    if (upsert && healthUpdates.length > 0) {
      for (const { id, last_quote_at } of healthUpdates) {
        const { error: healthError } = await supabase
          .from("symbols")
          .update({ last_quote_at })
          .eq("id", id)
          .or(`last_quote_at.is.null,last_quote_at.lt.${last_quote_at}`);

        if (healthError) {
          console.error(
            `Failed to update symbol health for ${id}:`,
            healthError,
          );
        }
      }
    }
  }

  // Populate alias keys for any original inputs that differed from canonical IDs
  normalizedRequests.forEach(({ inputLookup, canonicalId, dateString }) => {
    const canonicalCacheKey = `${canonicalId}|${dateString}`;
    const aliasCacheKey = `${inputLookup}|${dateString}`;
    if (inputLookup !== canonicalId && results.has(canonicalCacheKey)) {
      results.set(aliasCacheKey, results.get(canonicalCacheKey)!);
    }
  });

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
  symbolLookup: string,
  options: {
    date?: Date;
    upsert?: boolean;
  } = {},
): Promise<number> {
  const { date = new Date(), upsert = true } = options;
  const resolved = await resolveSymbolInput(symbolLookup);

  if (!resolved?.symbol?.id) {
    throw new Error(
      `Unable to resolve symbol identifier "${symbolLookup}" to a canonical symbol.`,
    );
  }

  const canonicalId = resolved.symbol.id;
  const dateKey = formatUtcDateKey(date);
  const quotes = await fetchQuotes(
    [{ symbolLookup: canonicalId, date }],
    upsert,
  );

  return (
    quotes.get(`${canonicalId}|${dateKey}`) ??
    quotes.get(`${symbolLookup}|${dateKey}`) ??
    0
  );
}
