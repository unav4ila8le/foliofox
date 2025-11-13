"use server";

import { addDays, compareAsc, format, parseISO, subDays } from "date-fns";
import YahooFinance from "yahoo-finance2";

import { createServiceClient } from "@/supabase/service";
import {
  resolveSymbolInput,
  resolveSymbolsBatch,
} from "@/server/symbols/resolver";

// Initialize yahooFinance with v3 pattern
const yahooFinance = new YahooFinance();

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

    const dateString = format(date, "yyyy-MM-dd");

    return {
      inputLookup: symbolLookup,
      canonicalId: resolution.canonicalId,
      yahooTicker: resolution.providerAlias,
      date,
      dateString,
      cacheKey: `${resolution.canonicalId}|${dateString}`,
    };
  });

  // Prepare cache queries for all requests (using canonical IDs)
  const cacheQueries = normalizedRequests.map((item) => ({
    symbolId: item.canonicalId,
    dateString: item.dateString,
    cacheKey: item.cacheKey,
  }));

  // 1. Always check database cache
  const supabase = await createServiceClient();

  // Get unique symbolIds and dateStrings for efficient query
  const symbolIds = [
    ...new Set(normalizedRequests.map((request) => request.canonicalId)),
  ];
  const dateStrings = [
    ...new Set(normalizedRequests.map((request) => request.dateString)),
  ];

  const chunkArray = <T>(arr: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // Chunk Supabase lookups to stay comfortably under Supabase's 1k row limit
  const MAX_ROWS_PER_QUERY = 900;
  const baseChunkSize = Math.max(1, Math.floor(Math.sqrt(MAX_ROWS_PER_QUERY)));
  const symbolChunkSize = Math.max(
    1,
    Math.min(symbolIds.length || 1, baseChunkSize),
  );
  const dateChunkSize = Math.max(
    1,
    Math.min(dateStrings.length || 1, baseChunkSize),
  );

  let cachedQuotes: Array<{ symbol_id: string; date: string; price: number }> =
    [];

  for (const symbolChunk of chunkArray(symbolIds, symbolChunkSize)) {
    for (const dateChunk of chunkArray(dateStrings, dateChunkSize)) {
      if (!symbolChunk.length || !dateChunk.length) continue;

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
        cachedQuotes = cachedQuotes.concat(data);
      }
    }
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
    // Group requested calendar days per symbol so we can batch chart calls
    const requestsBySymbol = new Map<string, Set<string>>();
    missingRequests.forEach(({ symbolId, dateString }) => {
      const existing = requestsBySymbol.get(symbolId);
      if (existing) existing.add(dateString);
      else requestsBySymbol.set(symbolId, new Set([dateString]));
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
          (entry): entry is { dateKey: string; price: number } =>
            entry !== null,
        )
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      let pointer = 0;
      let lastPrice: number | null = null;
      const requestedSet = new Set(dateStringsSorted);

      // Walk chronologically and reuse the latest available trade price
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

      // Final safety net: fallback to realtime quote when chart feed is empty
      if (!successfulFetches.some((entry) => entry.symbolId === symbolId)) {
        try {
          const realtimeQuote = await yahooFinance.quote(ticker);
          const marketPrice = realtimeQuote?.regularMarketPrice;
          const marketTimeRaw = realtimeQuote?.regularMarketTime;
          const marketTime = marketTimeRaw ? new Date(marketTimeRaw) : null;

          if (
            marketPrice &&
            marketPrice > 0 &&
            marketTime &&
            !Number.isNaN(marketTime.getTime())
          ) {
            const marketDateKey = format(marketTime, "yyyy-MM-dd");
            // Prefer an exact date match, otherwise fall back to the latest requested date.
            const fallbackDateKey = requestedSet.has(marketDateKey)
              ? marketDateKey
              : dateStringsSorted[dateStringsSorted.length - 1];

            if (fallbackDateKey) {
              const cacheKey = `${symbolId}|${fallbackDateKey}`;
              results.set(cacheKey, marketPrice);
              successfulFetches.push({
                symbolId,
                dateString: fallbackDateKey,
                price: marketPrice,
                cacheKey,
              });
            }
          }
        } catch (error) {
          console.warn(
            `Failed to fetch realtime quote for ${symbolId}:`,
            error,
          );
        }
      }
    }

    if (upsert && successfulFetches.length > 0) {
      const supabase = await createServiceClient();
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
  const dateKey = format(date, "yyyy-MM-dd");
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
