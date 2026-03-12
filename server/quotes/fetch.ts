"use server";

import { addDays, subDays } from "date-fns";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { chunkArray } from "@/server/shared/chunk-array";
import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import {
  resolveSymbolInput,
  resolveSymbolsBatch,
} from "@/server/symbols/resolve";
import { normalizeChartQuoteEntries } from "./utils";

const DEFAULT_STALE_GUARD_DAYS = 7;
const DEFAULT_CRON_CUTOFF_HOUR_UTC = 22;
const DEFAULT_LIVE_MISS_COOLDOWN_MINUTES = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const SYMBOL_HEALTH_UPDATE_BATCH_SIZE = 200;
const LIVE_MISS_COOLDOWN_RETENTION_MULTIPLIER = 4;
const LIVE_MISS_COOLDOWN_MIN_RETENTION_MS = 60 * MINUTE_IN_MS;
const liveMissCooldownByKey = new Map<string, number>();

export interface FetchQuotesOptions {
  upsert?: boolean;
  staleGuardDays?: number;
  cronCutoffHourUtc?: number;
  liveFetchOnMiss?: boolean;
  liveMissCooldownMinutes?: number;
  resolutionStats?: QuoteResolutionStats;
}

export interface QuoteResolutionStats {
  exactDateMatches: number;
  fallbackResolutions: number;
}

interface ResolvedQuoteRequest {
  inputLookup: string;
  canonicalId: string;
  requestedDateKey: string;
  effectiveDateKey: string;
}

interface QuotesCacheRow {
  symbol_id: string;
  date: string;
  close_price: number;
}

interface QuotesUpsertRow {
  symbol_id: string;
  date: string;
  close_price: number;
  adjusted_close_price: number;
}

function resolveFetchQuotesOptions(
  options: FetchQuotesOptions = {},
): Required<Omit<FetchQuotesOptions, "resolutionStats">> {
  const staleGuardDays = Math.max(
    0,
    Math.trunc(options.staleGuardDays ?? DEFAULT_STALE_GUARD_DAYS),
  );
  const cronCutoffHourUtc = Math.min(
    23,
    Math.max(
      0,
      Math.trunc(options.cronCutoffHourUtc ?? DEFAULT_CRON_CUTOFF_HOUR_UTC),
    ),
  );
  const liveMissCooldownMinutes = Math.max(
    0,
    Math.trunc(
      options.liveMissCooldownMinutes ?? DEFAULT_LIVE_MISS_COOLDOWN_MINUTES,
    ),
  );

  return {
    upsert: options.upsert ?? true,
    staleGuardDays,
    cronCutoffHourUtc,
    liveFetchOnMiss: options.liveFetchOnMiss ?? true,
    liveMissCooldownMinutes,
  };
}

function resolveEffectiveDateKey(
  requestedDateKey: string,
  cronCutoffHourUtc: number,
  now: Date,
): string {
  const todayDateKey = formatUTCDateKey(now);
  if (requestedDateKey !== todayDateKey) return requestedDateKey;

  if (now.getUTCHours() >= cronCutoffHourUtc) return requestedDateKey;

  return formatUTCDateKey(subDays(parseUTCDateKey(requestedDateKey), 1));
}

function isWithinStaleGuard(
  quoteDateKey: string,
  effectiveDateKey: string,
  staleGuardDays: number,
): boolean {
  const quoteMs = parseUTCDateKey(quoteDateKey).getTime();
  const effectiveMs = parseUTCDateKey(effectiveDateKey).getTime();
  const ageInDays = Math.floor((effectiveMs - quoteMs) / DAY_IN_MS);
  return ageInDays <= staleGuardDays;
}

function findLatestEntryAtOrBefore(
  entries: ReturnType<typeof normalizeChartQuoteEntries>,
  dateKey: string,
) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.dateKey <= dateKey) {
      return entry;
    }
  }
  return null;
}

function buildLiveMissCooldownKey(request: {
  canonicalId: string;
  effectiveDateKey: string;
}): string {
  return `${request.canonicalId}|${request.effectiveDateKey}`;
}

function pruneLiveMissCooldown(nowMs: number, cooldownMs: number): void {
  if (cooldownMs <= 0 || liveMissCooldownByKey.size === 0) return;

  const retentionMs = Math.max(
    cooldownMs * LIVE_MISS_COOLDOWN_RETENTION_MULTIPLIER,
    LIVE_MISS_COOLDOWN_MIN_RETENTION_MS,
  );

  for (const [key, lastAttemptMs] of liveMissCooldownByKey.entries()) {
    if (nowMs - lastAttemptMs > retentionMs) {
      liveMissCooldownByKey.delete(key);
    }
  }
}

async function fetchCachedQuotesBySymbolsAndDates(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  symbolIds: string[],
  dateKeys: string[],
): Promise<QuotesCacheRow[]> {
  if (!symbolIds.length || !dateKeys.length) return [];

  const MAX_ROWS_PER_QUERY = 900;
  const baseChunkSize = Math.max(1, Math.floor(Math.sqrt(MAX_ROWS_PER_QUERY)));
  const symbolChunkSize = Math.max(
    1,
    Math.min(symbolIds.length, baseChunkSize),
  );
  const dateChunkSize = Math.max(1, Math.min(dateKeys.length, baseChunkSize));

  const rows: QuotesCacheRow[] = [];

  for (const symbolChunk of chunkArray(symbolIds, symbolChunkSize)) {
    for (const dateChunk of chunkArray(dateKeys, dateChunkSize)) {
      const { data, error } = await supabase
        .from("quotes")
        .select("symbol_id, date, close_price")
        .in("symbol_id", symbolChunk)
        .in("date", dateChunk);

      if (error) {
        console.error("[fetchQuotes] cache query error:", error);
        continue;
      }

      if (data?.length) {
        rows.push(...data);
      }
    }
  }

  return rows;
}

async function resolvePriorCachedFallbacks(params: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  requests: ResolvedQuoteRequest[];
  staleGuardDays: number;
  results: Map<string, number>;
  resolutionTypeByRequestKey: Map<string, "exact" | "fallback">;
}) {
  const {
    supabase,
    requests,
    staleGuardDays,
    results,
    resolutionTypeByRequestKey,
  } = params;

  if (!requests.length || staleGuardDays <= 0) return;

  const unresolvedSymbolIds = [
    ...new Set(requests.map((request) => request.canonicalId)),
  ];
  const staleWindowDateKeys = new Set<string>();

  requests.forEach((request) => {
    const effectiveDate = parseUTCDateKey(request.effectiveDateKey);
    for (let offset = 1; offset <= staleGuardDays; offset += 1) {
      staleWindowDateKeys.add(formatUTCDateKey(subDays(effectiveDate, offset)));
    }
  });

  const cachedWindowRows = await fetchCachedQuotesBySymbolsAndDates(
    supabase,
    unresolvedSymbolIds,
    Array.from(staleWindowDateKeys),
  );

  const cachedRowsBySymbol = new Map<string, QuotesCacheRow[]>();
  cachedWindowRows.forEach((row) => {
    const existing = cachedRowsBySymbol.get(row.symbol_id) ?? [];
    existing.push(row);
    cachedRowsBySymbol.set(row.symbol_id, existing);
  });

  cachedRowsBySymbol.forEach((rows) => {
    rows.sort((a, b) => b.date.localeCompare(a.date));
  });

  requests.forEach((request) => {
    const rows = cachedRowsBySymbol.get(request.canonicalId);
    if (!rows?.length) return;

    const fallback = rows.find(
      (row) =>
        row.date <= request.effectiveDateKey &&
        isWithinStaleGuard(row.date, request.effectiveDateKey, staleGuardDays),
    );

    if (!fallback) return;

    const resultKey = `${request.canonicalId}|${request.requestedDateKey}`;
    results.set(resultKey, fallback.close_price);
    resolutionTypeByRequestKey.set(resultKey, "fallback");
  });
}

/**
 * Fetch multiple quotes for different symbols and dates in bulk.
 *
 * @param requests - Array of {symbolLookup, date} pairs to fetch
 * @param options - Quote fetch behavior options
 * @returns Map where key is "canonicalSymbolId|requestedDate" and value is close price
 */
export async function fetchQuotes(
  requests: Array<{ symbolLookup: string; date: Date }>,
  options: FetchQuotesOptions = {},
) {
  if (!requests.length) return new Map();

  const resolvedOptions = resolveFetchQuotesOptions(options);
  const now = new Date();
  const nowMs = now.getTime();
  const results = new Map<string, number>();
  const resolutionTypeByRequestKey = new Map<string, "exact" | "fallback">();

  // 1. Resolve all requested symbols to canonical IDs.
  const uniqueLookups = [...new Set(requests.map((r) => r.symbolLookup))];
  const { byInput, byCanonicalId } = await resolveSymbolsBatch(uniqueLookups, {
    provider: "yahoo",
    providerType: "ticker",
    onError: "throw",
  });

  // 2. Normalize request dates and compute effective as-of dates.
  const normalizedRequests: ResolvedQuoteRequest[] = requests.map(
    ({ symbolLookup, date }) => {
      const resolution = byInput.get(symbolLookup);
      if (!resolution) {
        throw new Error(
          `Unable to resolve symbol identifier "${symbolLookup}" to a canonical symbol.`,
        );
      }

      const requestedDateKey = formatUTCDateKey(date);
      const effectiveDateKey = resolveEffectiveDateKey(
        requestedDateKey,
        resolvedOptions.cronCutoffHourUtc,
        now,
      );

      return {
        inputLookup: symbolLookup,
        canonicalId: resolution.canonicalId,
        requestedDateKey,
        effectiveDateKey,
      };
    },
  );

  const supabase = await createServiceClient();

  const symbolIds = [
    ...new Set(normalizedRequests.map((request) => request.canonicalId)),
  ];
  const effectiveDateKeys = [
    ...new Set(normalizedRequests.map((request) => request.effectiveDateKey)),
  ];

  // 3. Exact-date cache lookup using effective date keys.
  const cachedExactRows = await fetchCachedQuotesBySymbolsAndDates(
    supabase,
    symbolIds,
    effectiveDateKeys,
  );

  const exactPriceByKey = new Map<string, number>();
  cachedExactRows.forEach((row) => {
    exactPriceByKey.set(`${row.symbol_id}|${row.date}`, row.close_price);
  });
  const symbolHealthById = new Map<string, string>();

  const recordSymbolHealth = (symbolId: string, dateKey: string) => {
    const nextLastQuoteAt = new Date(`${dateKey}T00:00:00Z`).toISOString();
    const existingLastQuoteAt = symbolHealthById.get(symbolId);

    if (!existingLastQuoteAt || existingLastQuoteAt < nextLastQuoteAt) {
      symbolHealthById.set(symbolId, nextLastQuoteAt);
    }
  };

  if (resolvedOptions.upsert) {
    // Keep symbol health aligned even when every request is resolved from cache.
    cachedExactRows.forEach((row) => {
      recordSymbolHealth(row.symbol_id, row.date);
    });
  }

  const unresolvedRequests: ResolvedQuoteRequest[] = [];
  for (const request of normalizedRequests) {
    const exactPrice = exactPriceByKey.get(
      `${request.canonicalId}|${request.effectiveDateKey}`,
    );

    if (exactPrice !== undefined) {
      const resultKey = `${request.canonicalId}|${request.requestedDateKey}`;
      results.set(resultKey, exactPrice);
      resolutionTypeByRequestKey.set(resultKey, "exact");
      continue;
    }

    unresolvedRequests.push(request);
  }

  // 4. Resolve weekend/holiday gaps from prior cached market days before
  // attempting any live provider repair.
  await resolvePriorCachedFallbacks({
    supabase,
    requests: unresolvedRequests.filter(
      (request) =>
        !results.has(`${request.canonicalId}|${request.requestedDateKey}`),
    ),
    staleGuardDays: resolvedOptions.staleGuardDays,
    results,
    resolutionTypeByRequestKey,
  });

  // 5. Live fetch exact-date cache misses and persist provider market-date rows.
  const liveMissCooldownMs =
    resolvedOptions.liveMissCooldownMinutes * MINUTE_IN_MS;
  pruneLiveMissCooldown(nowMs, liveMissCooldownMs);

  const requestsNeedingLiveFetch = unresolvedRequests.filter((request) => {
    const requestResultKey = `${request.canonicalId}|${request.requestedDateKey}`;
    if (results.has(requestResultKey)) return false;

    if (liveMissCooldownMs <= 0) return true;

    const cooldownKey = buildLiveMissCooldownKey(request);
    const lastAttemptMs = liveMissCooldownByKey.get(cooldownKey);
    if (lastAttemptMs === undefined) return true;

    if (nowMs - lastAttemptMs >= liveMissCooldownMs) {
      liveMissCooldownByKey.delete(cooldownKey);
      return true;
    }

    return false;
  });

  if (resolvedOptions.liveFetchOnMiss && requestsNeedingLiveFetch.length > 0) {
    const requestsBySymbol = new Map<string, ResolvedQuoteRequest[]>();
    requestsNeedingLiveFetch.forEach((request) => {
      const list = requestsBySymbol.get(request.canonicalId) ?? [];
      list.push(request);
      requestsBySymbol.set(request.canonicalId, list);
    });

    const upsertRowsByKey = new Map<string, QuotesUpsertRow>();

    for (const [symbolId, symbolRequests] of requestsBySymbol.entries()) {
      const effectiveDateKeysSorted = [
        ...new Set(symbolRequests.map((request) => request.effectiveDateKey)),
      ].sort((a, b) => a.localeCompare(b));

      if (!effectiveDateKeysSorted.length) continue;

      const earliestEffective = parseUTCDateKey(effectiveDateKeysSorted[0]);
      const latestEffective = parseUTCDateKey(
        effectiveDateKeysSorted[effectiveDateKeysSorted.length - 1],
      );

      const bufferedStart = subDays(earliestEffective, 7);
      const periodEndExclusive = addDays(latestEffective, 1);

      const resolution = byCanonicalId.get(symbolId);
      const ticker = resolution?.providerAlias;
      if (!ticker) {
        console.warn(
          `Skipping quote fetch for symbol ${symbolId}: missing Yahoo ticker alias.`,
        );
        continue;
      }

      let chartData;
      let liveFetchFailed = false;
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
        liveFetchFailed = true;
        chartData = null;
      }

      const quoteEntries = normalizeChartQuoteEntries(chartData);

      if (resolvedOptions.upsert) {
        quoteEntries.forEach((entry) => {
          upsertRowsByKey.set(`${symbolId}|${entry.dateKey}`, {
            symbol_id: symbolId,
            date: entry.dateKey,
            close_price: entry.closePrice,
            adjusted_close_price: entry.adjustedClosePrice,
          });
        });
      }

      symbolRequests.forEach((request) => {
        const mapKey = `${request.canonicalId}|${request.requestedDateKey}`;
        const fallbackEntry = findLatestEntryAtOrBefore(
          quoteEntries,
          request.effectiveDateKey,
        );
        if (fallbackEntry) {
          results.set(mapKey, fallbackEntry.closePrice);
          resolutionTypeByRequestKey.set(
            mapKey,
            fallbackEntry.dateKey === request.effectiveDateKey
              ? "exact"
              : "fallback",
          );
        }
      });

      // Final safety net when chart rows do not resolve all requests.
      const fallbackPrice = chartData?.meta?.regularMarketPrice;
      const fallbackTime = chartData?.meta?.regularMarketTime;
      const allSymbolRequestsResolved = symbolRequests.every((request) =>
        results.has(`${request.canonicalId}|${request.requestedDateKey}`),
      );
      if (
        !allSymbolRequestsResolved &&
        fallbackPrice &&
        fallbackPrice > 0 &&
        fallbackTime instanceof Date
      ) {
        const fallbackDateKey = formatUTCDateKey(fallbackTime);
        const fallbackRowKey = `${symbolId}|${fallbackDateKey}`;

        if (resolvedOptions.upsert && !upsertRowsByKey.has(fallbackRowKey)) {
          upsertRowsByKey.set(fallbackRowKey, {
            symbol_id: symbolId,
            date: fallbackDateKey,
            close_price: fallbackPrice,
            adjusted_close_price: fallbackPrice,
          });
        }

        symbolRequests.forEach((request) => {
          const mapKey = `${request.canonicalId}|${request.requestedDateKey}`;
          if (results.has(mapKey)) return;

          if (fallbackDateKey <= request.effectiveDateKey) {
            results.set(mapKey, fallbackPrice);
            resolutionTypeByRequestKey.set(
              mapKey,
              fallbackDateKey === request.effectiveDateKey
                ? "exact"
                : "fallback",
            );
          }
        });
      }

      // Only cool down confirmed "no data" cases. If the provider call failed,
      // skip cooldown so the next request can retry immediately.
      if (!liveFetchFailed && liveMissCooldownMs > 0) {
        symbolRequests.forEach((request) => {
          const requestResultKey = `${request.canonicalId}|${request.requestedDateKey}`;
          const cooldownKey = buildLiveMissCooldownKey(request);

          if (results.has(requestResultKey)) {
            liveMissCooldownByKey.delete(cooldownKey);
            return;
          }

          liveMissCooldownByKey.set(cooldownKey, nowMs);
        });
      }

      if (resolvedOptions.upsert) {
        const latestDateKey =
          quoteEntries[quoteEntries.length - 1]?.dateKey ??
          (fallbackTime instanceof Date
            ? formatUTCDateKey(fallbackTime)
            : null);

        if (latestDateKey) {
          recordSymbolHealth(symbolId, latestDateKey);
        }
      }
    }

    if (resolvedOptions.upsert && upsertRowsByKey.size > 0) {
      const upsertRows = Array.from(upsertRowsByKey.values()).sort((a, b) => {
        if (a.symbol_id === b.symbol_id) {
          return a.date.localeCompare(b.date);
        }
        return a.symbol_id.localeCompare(b.symbol_id);
      });

      const { error: insertError } = await supabase
        .from("quotes")
        .upsert(upsertRows, { onConflict: "symbol_id,date" });

      if (insertError) {
        console.error("Failed to bulk insert quotes:", insertError);
      }
    }
  }

  if (resolvedOptions.upsert && symbolHealthById.size > 0) {
    const symbolIdsByLastQuoteAt = new Map<string, string[]>();
    symbolHealthById.forEach((last_quote_at, id) => {
      const ids = symbolIdsByLastQuoteAt.get(last_quote_at) ?? [];
      ids.push(id);
      symbolIdsByLastQuoteAt.set(last_quote_at, ids);
    });

    // Grouping by identical market dates keeps monotonic guard semantics while
    // reducing one update query per symbol down to one update query per batch.
    for (const [last_quote_at, symbolIds] of symbolIdsByLastQuoteAt.entries()) {
      for (const symbolIdBatch of chunkArray(
        [...new Set(symbolIds)],
        SYMBOL_HEALTH_UPDATE_BATCH_SIZE,
      )) {
        const { error: healthError } = await supabase
          .from("symbols")
          .update({ last_quote_at })
          .in("id", symbolIdBatch)
          .or(`last_quote_at.is.null,last_quote_at.lt.${last_quote_at}`);

        if (healthError) {
          console.error(
            `Failed to update symbol health batch for ${last_quote_at} (${symbolIdBatch.length} symbols):`,
            healthError,
          );
        }
      }
    }
  }

  if (options.resolutionStats) {
    // Report how requests were fulfilled for observability (exact date vs fallback date).
    options.resolutionStats.exactDateMatches = 0;
    options.resolutionStats.fallbackResolutions = 0;

    for (const resolutionType of resolutionTypeByRequestKey.values()) {
      if (resolutionType === "exact") {
        options.resolutionStats.exactDateMatches += 1;
      } else {
        options.resolutionStats.fallbackResolutions += 1;
      }
    }
  }

  // 6. Populate alias keys for original non-canonical lookup inputs.
  normalizedRequests.forEach((request) => {
    if (request.inputLookup === request.canonicalId) return;

    const canonicalKey = `${request.canonicalId}|${request.requestedDateKey}`;
    const aliasKey = `${request.inputLookup}|${request.requestedDateKey}`;
    const canonicalValue = results.get(canonicalKey);

    if (canonicalValue !== undefined) {
      results.set(aliasKey, canonicalValue);
    }
  });

  return results;
}

export interface FetchSingleQuoteOptions extends FetchQuotesOptions {
  date?: Date;
}

/**
 * Fetch a single quote for a specific symbol and date.
 *
 * @param symbolLookup - Symbol ID, ticker alias, or lookup input
 * @param options - Optional configuration
 * @returns Close price for the requested date key (or 0 if unavailable)
 */
export async function fetchSingleQuote(
  symbolLookup: string,
  options: FetchSingleQuoteOptions = {},
): Promise<number> {
  const { date = new Date(), ...fetchOptions } = options;

  const resolved = await resolveSymbolInput(symbolLookup);
  if (!resolved?.symbol?.id) {
    throw new Error(
      `Unable to resolve symbol identifier "${symbolLookup}" to a canonical symbol.`,
    );
  }

  const canonicalId = resolved.symbol.id;
  const dateKey = formatUTCDateKey(date);
  const quotes = await fetchQuotes(
    [{ symbolLookup: canonicalId, date }],
    fetchOptions,
  );

  return (
    quotes.get(`${canonicalId}|${dateKey}`) ??
    quotes.get(`${symbolLookup}|${dateKey}`) ??
    0
  );
}
