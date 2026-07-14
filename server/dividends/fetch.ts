"use server";

import { subDays, subYears } from "date-fns";

import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import { normalizeQuoteToCurrencyRate } from "@/server/market-data/quote-units";
import { resolveSymbolsBatch } from "@/server/symbols/resolve";
import {
  extractStatusCode,
  isTransientError,
  stringifyError,
} from "@/server/shared/retry";
import { formatUTCDateKey } from "@/lib/date/date-utils";

import type { Dividend, DividendEvent } from "@/types/global.types";

export interface FetchDividendsOptions {
  /**
   * Write refreshed Yahoo results back to `dividends` and `dividend_events`.
   * Defaults to true for normal user-facing reads.
   */
  upsert?: boolean;
  /**
   * Read existing dividend rows before calling Yahoo. Defaults to true.
   * Use false for on-demand probes that should bypass cached data entirely.
   */
  readCache?: boolean;
  /**
   * Fetch missing or stale cache entries from Yahoo. Defaults to true.
   * Use false for cron/email paths where predictable runtime matters more
   * than refreshing dividend data.
   */
  refreshMissing?: boolean;
}

interface ResolvedFetchDividendsOptions {
  upsert: boolean;
  readCache: boolean;
  refreshMissing: boolean;
  allowStaleCache: boolean;
}

interface FetchedDividendResult {
  symbolId: string;
  events: DividendEvent[];
  summary: Dividend | null;
  shouldUpsert?: boolean;
}

function resolveFetchDividendsOptions(
  options: FetchDividendsOptions = {},
): ResolvedFetchDividendsOptions {
  const refreshMissing = options.refreshMissing ?? true;
  const readCache = options.readCache ?? true;

  return {
    upsert: options.upsert ?? true,
    readCache,
    refreshMissing,
    allowStaleCache: readCache && refreshMissing === false,
  };
}

function isTransientDividendProviderError(error: unknown) {
  const statusCode = extractStatusCode(error);
  if (statusCode === 408 || statusCode === 429) {
    return true;
  }

  return isTransientError(error);
}

function isKnownNoDividendDataError(error: unknown) {
  return /no fundamentals data/i.test(stringifyError(error));
}

function createNoDividendsMarker(symbolId: string): Dividend {
  const now = new Date().toISOString();

  return {
    symbol_id: symbolId,
    forward_annual_dividend: null,
    trailing_ttm_dividend: null,
    dividend_yield: null,
    ex_dividend_date: null,
    last_dividend_date: null,
    inferred_frequency: null,
    pays_dividends: false,
    dividends_checked_at: now,
    created_at: now,
    updated_at: now,
  };
}

function resolveLatestDividendEventDate(events: DividendEvent[]) {
  let latestDate: string | null = null;

  events.forEach((event) => {
    if (!latestDate || event.event_date > latestDate) {
      latestDate = event.event_date;
    }
  });

  return latestDate;
}

/**
 * Reconstruct a lightweight summary when stale cache mode finds event rows
 * but no matching `dividends` row. This lets cron use known historical data
 * without refreshing Yahoo during email sending.
 */
function createDividendSummaryFromEvents(
  symbolId: string,
  events: DividendEvent[],
): Dividend {
  const now = new Date().toISOString();

  return {
    symbol_id: symbolId,
    forward_annual_dividend: null,
    trailing_ttm_dividend: null,
    dividend_yield: null,
    ex_dividend_date: null,
    last_dividend_date: resolveLatestDividendEventDate(events),
    inferred_frequency: detectDividendFrequency(events),
    pays_dividends: true,
    dividends_checked_at: now,
    created_at: now,
    updated_at: now,
  };
}

function resolveExistingPayerDividendResult(params: {
  symbolId: string;
  eventsBySymbol: Map<string, DividendEvent[]>;
  summariesBySymbol: Map<string, Dividend>;
}): FetchedDividendResult | null {
  const { eventsBySymbol, summariesBySymbol, symbolId } = params;
  const existingSummary = summariesBySymbol.get(symbolId);
  const existingHasPayerData = Boolean(
    existingSummary?.pays_dividends === true ||
    existingSummary?.forward_annual_dividend ||
    existingSummary?.trailing_ttm_dividend ||
    existingSummary?.dividend_yield ||
    existingSummary?.last_dividend_date,
  );

  if (!existingSummary || !existingHasPayerData) {
    return null;
  }

  return {
    symbolId,
    events: eventsBySymbol.get(symbolId) || [],
    summary: existingSummary,
    shouldUpsert: false,
  };
}

/**
 * Fetch dividend data for multiple symbols in bulk.
 * @param requests - Array of {symbolId} objects
 * @param options - Cache read, provider refresh, and cache write behavior.
 * Default: read fresh cache, refresh misses/stale entries from Yahoo, then
 * upsert refreshed results. Cron/email callers pass `{ refreshMissing: false }`
 * for cache-only reads that may use stale summaries. On-demand probes can pass
 * `{ upsert: false }` to reuse cache and live-refresh without writing results.
 * @returns Map where key is symbolId and value is {events, summary} objects
 */
export async function fetchDividends(
  requests: Array<{ symbolId: string }>,
  options: FetchDividendsOptions = {},
) {
  const resolvedOptions = resolveFetchDividendsOptions(options);

  // Early return if no requests
  if (!requests.length) return new Map();

  // 1) Batch resolve all symbol identifiers to canonical UUIDs and Yahoo tickers
  const uniqueInputs = requests
    .map((r) => r.symbolId.trim())
    .filter((symbolId) => symbolId.length > 0);

  const { byInput, byCanonicalId } = await resolveSymbolsBatch(uniqueInputs, {
    provider: "yahoo",
    providerType: "ticker",
    onError: "throw",
  });

  const canonicalIds = [...byCanonicalId.keys()];

  // 2) Warm the cache with any dividend rows already stored in the database
  const canonicalResults = new Map<
    string,
    { events: DividendEvent[]; summary: Dividend }
  >();

  const supabase = createServiceClient();
  const eventsBySymbol = new Map<string, DividendEvent[]>();
  const summariesBySymbol = new Map<string, Dividend>();

  if (resolvedOptions.readCache) {
    const eventsDateThreshold = subYears(new Date(), 3).toISOString();
    const summariesDateThreshold = subDays(new Date(), 7).toISOString();
    const cachedEventsQuery = supabase
      .from("dividend_events")
      .select("*")
      .in("symbol_id", canonicalIds);
    const cachedSummariesQuery = supabase
      .from("dividends")
      .select("*")
      .in("symbol_id", canonicalIds);

    const [cachedEvents, cachedSummaries] = await Promise.all([
      cachedEventsQuery.gte("event_date", eventsDateThreshold),
      resolvedOptions.allowStaleCache
        ? cachedSummariesQuery
        : cachedSummariesQuery.gte("updated_at", summariesDateThreshold),
    ]);

    if (cachedEvents.error) {
      console.error(
        `Failed to fetch cached dividend events:`,
        cachedEvents.error,
      );
    }

    if (cachedSummaries.error) {
      console.error(
        `Failed to fetch cached dividend summaries:`,
        cachedSummaries.error,
      );
    }

    cachedEvents.data?.forEach((event: DividendEvent) => {
      const existing = eventsBySymbol.get(event.symbol_id) || [];
      existing.push(event);
      eventsBySymbol.set(event.symbol_id, existing);
    });

    cachedSummaries.data?.forEach((summary: Dividend) => {
      summariesBySymbol.set(summary.symbol_id, summary);
    });

    canonicalIds.forEach((symbolId) => {
      const events = eventsBySymbol.get(symbolId) || [];
      const summary = summariesBySymbol.get(symbolId);

      const hasEvents = events.length > 0;
      const isFreshCheck =
        summary?.dividends_checked_at &&
        new Date(summary.dividends_checked_at) >=
          new Date(summariesDateThreshold);

      if (resolvedOptions.allowStaleCache) {
        if (summary) {
          canonicalResults.set(symbolId, { events, summary });
          return;
        }

        if (!summary && hasEvents) {
          canonicalResults.set(symbolId, {
            events,
            summary: createDividendSummaryFromEvents(symbolId, events),
          });
        }
      } else {
        const isFreshNonPayer =
          summary?.pays_dividends === false && isFreshCheck;
        const isFreshPayer =
          summary?.pays_dividends === true && hasEvents && isFreshCheck;

        if (isFreshPayer || isFreshNonPayer) {
          canonicalResults.set(symbolId, { events, summary: summary! });
        }
      }
    });
  }

  const missingCanonicalIds = canonicalIds.filter(
    (symbolId) => !canonicalResults.has(symbolId),
  );

  if (resolvedOptions.refreshMissing && missingCanonicalIds.length > 0) {
    // 3) Fetch missing dividend data from Yahoo Finance (bulk per canonical symbol)
    const fetchPromises = missingCanonicalIds.map(
      async (symbolId): Promise<FetchedDividendResult> => {
        const resolution = byCanonicalId.get(symbolId);
        if (!resolution?.providerAlias) {
          console.error(
            `Failed to fetch dividends for ${symbolId}: missing Yahoo ticker alias.`,
          );
          return { symbolId, events: [], summary: null as Dividend | null };
        }

        const yahooTicker = resolution.providerAlias;
        const dividendCurrency = resolution.currency;
        const quoteToCurrencyRate = normalizeQuoteToCurrencyRate(
          resolution.quoteToCurrencyRate,
        );

        try {
          const [summaryResult, chartResult] = await Promise.allSettled([
            yahooFinance.quoteSummary(yahooTicker, {
              modules: ["summaryDetail", "calendarEvents"],
            }),
            yahooFinance.chart(yahooTicker, {
              period1: subYears(new Date(), 3),
              period2: new Date(),
              events: "div",
            }),
          ]);
          const summary =
            summaryResult.status === "fulfilled" ? summaryResult.value : null;
          const chart =
            chartResult.status === "fulfilled" ? chartResult.value : null;
          const providerErrors = [summaryResult, chartResult].flatMap(
            (result) => (result.status === "rejected" ? [result.reason] : []),
          );
          const hasTransientProviderError = providerErrors.some(
            isTransientDividendProviderError,
          );
          const hasKnownNoDataError = providerErrors.some(
            isKnownNoDividendDataError,
          );

          const events: DividendEvent[] = [];
          if (chart?.events?.dividends) {
            chart.events.dividends.forEach((dividend) => {
              // Yahoo chart dividend amounts use the same provider quote unit
              // as chart prices. The symbol row already stores the normalized
              // ISO currency and multiplier, so cache dividend events in that
              // accounting currency instead of leaking GBp/KWF-style units.
              events.push({
                id: crypto.randomUUID(),
                symbol_id: symbolId,
                event_date: formatUTCDateKey(dividend.date),
                gross_amount: dividend.amount * quoteToCurrencyRate,
                currency: dividendCurrency,
                source: "yahoo",
                created_at: new Date().toISOString(),
              });
            });
          }

          const inferred_frequency = detectDividendFrequency(events);
          const last_dividend_date = resolveLatestDividendEventDate(events);

          const hasDividendData =
            summary?.summaryDetail?.dividendRate ||
            summary?.summaryDetail?.trailingAnnualDividendRate ||
            summary?.summaryDetail?.dividendYield ||
            events.length > 0;

          if (hasDividendData) {
            const now = new Date().toISOString();
            // Do not quote-unit scale summaryDetail dividend amounts here.
            // Yahoo's summary fields are independent from chart events and can
            // already be reported as major-currency annual values.
            const summaryData: Dividend = {
              symbol_id: symbolId,
              forward_annual_dividend:
                summary?.summaryDetail?.dividendRate || null,
              trailing_ttm_dividend:
                summary?.summaryDetail?.trailingAnnualDividendRate || null,
              dividend_yield: summary?.summaryDetail?.dividendYield || null,
              ex_dividend_date: summary?.calendarEvents?.exDividendDate
                ? formatUTCDateKey(summary.calendarEvents.exDividendDate)
                : null,
              last_dividend_date,
              inferred_frequency,
              pays_dividends: true,
              dividends_checked_at: now,
              created_at: now,
              updated_at: now,
            };

            return { symbolId, events, summary: summaryData };
          }

          // Avoid overwriting existing payer data if it exists.
          const existingPayerResult = resolveExistingPayerDividendResult({
            symbolId,
            eventsBySymbol,
            summariesBySymbol,
          });

          if (existingPayerResult) {
            return existingPayerResult;
          }

          if (
            hasTransientProviderError ||
            (providerErrors.length > 0 && !hasKnownNoDataError)
          ) {
            console.warn(
              `Failed to fetch dividends for ${symbolId} (${yahooTicker}):`,
              providerErrors.map(stringifyError).join("; "),
            );
            return { symbolId, events: [], summary: null as Dividend | null };
          }

          return {
            symbolId,
            events,
            summary: createNoDividendsMarker(symbolId),
          };
        } catch (error) {
          console.warn(
            `Failed to parse dividends for ${symbolId} (${yahooTicker}):`,
            error,
          );

          return (
            resolveExistingPayerDividendResult({
              symbolId,
              eventsBySymbol,
              summariesBySymbol,
            }) ?? { symbolId, events: [], summary: null as Dividend | null }
          );
        }
      },
    );

    const fetchResults = await Promise.all(fetchPromises);

    const allEvents: DividendEvent[] = [];
    const allSummaries: Dividend[] = [];

    fetchResults.forEach(({ symbolId, events, summary, shouldUpsert }) => {
      const shouldUpsertResult = shouldUpsert ?? true;

      if (events.length > 0 && shouldUpsertResult) {
        allEvents.push(...events);
      }

      if (summary) {
        canonicalResults.set(symbolId, { events, summary });
        if (shouldUpsertResult) {
          allSummaries.push(summary);
        }
      }
    });

    if (resolvedOptions.upsert) {
      // Sort by PK components to avoid lock-order deadlocks
      allEvents.sort((a, b) => {
        if (a.symbol_id === b.symbol_id) {
          if (a.event_date === b.event_date) {
            return 0;
          }
          return a.event_date < b.event_date ? -1 : 1;
        }
        return a.symbol_id.localeCompare(b.symbol_id);
      });
      allSummaries.sort((a, b) => a.symbol_id.localeCompare(b.symbol_id));

      const [eventsResult, summariesResult] = await Promise.all([
        allEvents.length > 0
          ? supabase
              .from("dividend_events")
              .upsert(allEvents, { onConflict: "symbol_id,event_date" })
          : Promise.resolve({ data: null, error: null }),
        allSummaries.length > 0
          ? supabase
              .from("dividends")
              .upsert(allSummaries, { onConflict: "symbol_id" })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (eventsResult.error) {
        console.error(
          `Failed to insert ${allEvents.length} dividend events:`,
          eventsResult.error,
        );
      }
      if (summariesResult.error) {
        console.error(
          `Failed to insert ${allSummaries.length} dividend summaries:`,
          summariesResult.error,
        );
      }
    }
  }

  // 4) Return a map keyed by the caller's original identifier, defaulting to canonical data
  const finalResults = new Map<
    string,
    { events: DividendEvent[]; summary: Dividend }
  >();

  byInput.forEach(({ canonicalId }, inputKey) => {
    const canonical = canonicalResults.get(canonicalId);
    if (canonical) {
      finalResults.set(inputKey, canonical);
    }
  });

  return finalResults;
}

/**
 * Detect dividend frequency from historical events
 */
function detectDividendFrequency(events: DividendEvent[]): string {
  if (events.length < 2) return "irregular";

  // Sort events by date
  const sortedEvents = events.slice().sort((a, b) => {
    if (a.event_date === b.event_date) {
      return 0;
    }
    return a.event_date < b.event_date ? -1 : 1;
  });

  // Calculate gaps between payments in months
  const gaps = sortedEvents.reduce((acc, curr, i) => {
    if (i === 0) return acc;
    const prevDate = new Date(sortedEvents[i - 1].event_date);
    const currDate = new Date(curr.event_date);
    const monthsDiff =
      (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
      (currDate.getMonth() - prevDate.getMonth());
    acc.push(monthsDiff);
    return acc;
  }, [] as number[]);

  if (gaps.length === 0) return "irregular";

  // Find most common gap
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap <= 1.5) return "monthly";
  if (avgGap <= 4) return "quarterly";
  if (avgGap <= 7) return "semiannual";
  if (avgGap <= 13) return "annual";
  return "irregular";
}
