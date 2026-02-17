"use server";

import { createServiceClient } from "@/supabase/service";
import {
  addUTCDays,
  formatUTCDateKey,
  parseUTCDateKey,
} from "@/lib/date/date-utils";

// Exchange rate API
const FRANKFURTER_API = "https://api.frankfurter.app";
const FALLBACK_API = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api"; //https://github.com/fawazahmed0/exchange-api
const MAX_FALLBACK_LOOKBACK_DAYS = 31;
const DEFAULT_STALE_GUARD_DAYS = 7;
const DEFAULT_CRON_CUTOFF_HOUR_UTC = 22;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface FetchExchangeRatesOptions {
  upsert?: boolean;
  staleGuardDays?: number;
  cronCutoffHourUtc?: number;
}

/**
 * Normalize exchange-rate fetch options and clamp numeric values to safe bounds.
 */
function resolveFetchExchangeRatesOptions(
  options: FetchExchangeRatesOptions = {},
): Required<FetchExchangeRatesOptions> {
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

  return {
    upsert: options.upsert ?? true,
    staleGuardDays,
    cronCutoffHourUtc,
  };
}

/**
 * Resolve the effective date used by FX reads.
 *
 * For "today" requests before the configured UTC cutoff, use the previous day.
 * For all other dates, keep the requested date unchanged.
 */
function resolveEffectiveDateKey(params: {
  requestedDateKey: string;
  cronCutoffHourUtc: number;
  now: Date;
}): string {
  const { requestedDateKey, cronCutoffHourUtc, now } = params;
  const todayDateKey = formatUTCDateKey(now);

  if (requestedDateKey !== todayDateKey) {
    return requestedDateKey;
  }

  if (now.getUTCHours() >= cronCutoffHourUtc) {
    return requestedDateKey;
  }

  return formatUTCDateKey(addUTCDays(parseUTCDateKey(requestedDateKey), -1));
}

type CachedExchangeRateRow = {
  target_currency: string;
  date: string;
  rate: number;
};

type NormalizedExchangeRateRequest = {
  currency: string;
  requestedDateKey: string;
  effectiveDateKey: string;
  requestedCacheKey: string;
};

type ProviderRateEntry = {
  currency: string;
  rate: number;
  effectiveDateKey: string;
};

const MAX_ROWS_PER_QUERY = 900;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < arr.length; index += size) {
    chunks.push(arr.slice(index, index + size));
  }
  return chunks;
}

function isWithinStaleGuard(params: {
  candidateDateKey: string;
  effectiveDateKey: string;
  staleGuardDays: number;
}): boolean {
  const { candidateDateKey, effectiveDateKey, staleGuardDays } = params;
  const candidateMs = parseUTCDateKey(candidateDateKey).getTime();
  const effectiveMs = parseUTCDateKey(effectiveDateKey).getTime();

  if (candidateMs > effectiveMs) return false;

  const ageInDays = Math.floor((effectiveMs - candidateMs) / DAY_IN_MS);
  return ageInDays <= staleGuardDays;
}

function resolveProviderDateKey(
  providerDateKey: unknown,
  fallbackDateKey: string,
): string {
  if (typeof providerDateKey !== "string") {
    return fallbackDateKey;
  }

  const parsed = parseUTCDateKey(providerDateKey);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDateKey;
  }

  return providerDateKey;
}

async function fetchCachedRatesByCurrenciesAndDates(params: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  currencies: string[];
  dateKeys: string[];
}): Promise<CachedExchangeRateRow[]> {
  const { supabase, currencies, dateKeys } = params;
  if (!currencies.length || !dateKeys.length) return [];

  // Chunk Supabase lookups to stay comfortably under Supabase's 1k row limit.
  const baseChunkSize = Math.max(1, Math.floor(Math.sqrt(MAX_ROWS_PER_QUERY)));
  const currencyChunkSize = Math.max(
    1,
    Math.min(currencies.length || 1, baseChunkSize),
  );
  const dateChunkSize = Math.max(
    1,
    Math.min(dateKeys.length || 1, baseChunkSize),
  );

  const rows: CachedExchangeRateRow[] = [];

  for (const currencyChunk of chunkArray(currencies, currencyChunkSize)) {
    for (const dateChunk of chunkArray(dateKeys, dateChunkSize)) {
      if (!currencyChunk.length || !dateChunk.length) continue;

      const { data, error } = await supabase
        .from("exchange_rates")
        .select("target_currency, date, rate")
        .eq("base_currency", "USD")
        .in("target_currency", currencyChunk)
        .in("date", dateChunk);

      if (error) {
        console.error("[fetchExchangeRates] cache query error:", error);
        continue;
      }

      if (data?.length) {
        rows.push(...data);
      }
    }
  }

  return rows;
}

/**
 * Fetch multiple exchange rates for different currencies and dates in bulk.
 *
 * @param requests - Array of {currency, date} pairs to fetch
 * @returns Map where key is "currency|date" and value is the rate
 */
export async function fetchExchangeRates(
  requests: Array<{ currency: string; date: Date }>,
  options: FetchExchangeRatesOptions = {},
) {
  const resolvedOptions = resolveFetchExchangeRatesOptions(options);

  // Early return if no requests
  if (!requests.length) return new Map();

  const now = new Date();
  const results = new Map<string, number>();

  const normalizedRequests: NormalizedExchangeRateRequest[] = requests.map(
    ({ currency, date }) => {
      const requestedDateKey = formatUTCDateKey(date);
      const effectiveDateKey = resolveEffectiveDateKey({
        requestedDateKey,
        cronCutoffHourUtc: resolvedOptions.cronCutoffHourUtc,
        now,
      });

      return {
        currency,
        requestedDateKey,
        effectiveDateKey,
        requestedCacheKey: `${currency}|${requestedDateKey}`,
      };
    },
  );

  // Handle USD requests immediately (rate = 1).
  const nonUsdRequests = normalizedRequests.filter((request) => {
    if (request.currency === "USD") {
      results.set(request.requestedCacheKey, 1);
      return false;
    }
    return true;
  });

  if (nonUsdRequests.length === 0) return results;

  const supabase = await createServiceClient();

  // 1) Exact cache lookup by effective date.
  const exactCurrencies = [...new Set(nonUsdRequests.map((r) => r.currency))];
  const exactDateKeys = [
    ...new Set(nonUsdRequests.map((r) => r.effectiveDateKey)),
  ];
  const exactRows = await fetchCachedRatesByCurrenciesAndDates({
    supabase,
    currencies: exactCurrencies,
    dateKeys: exactDateKeys,
  });
  const exactRateByCurrencyDate = new Map<string, number>();
  exactRows.forEach((row) => {
    exactRateByCurrencyDate.set(`${row.target_currency}|${row.date}`, row.rate);
  });

  nonUsdRequests.forEach((request) => {
    const exactRate = exactRateByCurrencyDate.get(
      `${request.currency}|${request.effectiveDateKey}`,
    );
    if (exactRate !== undefined) {
      results.set(request.requestedCacheKey, exactRate);
    }
  });

  let unresolvedRequests = nonUsdRequests.filter(
    (request) => !results.has(request.requestedCacheKey),
  );

  // 2) Prior-date cache lookup within stale guard window.
  if (unresolvedRequests.length > 0 && resolvedOptions.staleGuardDays > 0) {
    const staleWindowDateKeys = new Set<string>();
    unresolvedRequests.forEach((request) => {
      for (
        let offset = 1;
        offset <= resolvedOptions.staleGuardDays;
        offset += 1
      ) {
        staleWindowDateKeys.add(
          formatUTCDateKey(
            addUTCDays(parseUTCDateKey(request.effectiveDateKey), -offset),
          ),
        );
      }
    });

    const priorRows = await fetchCachedRatesByCurrenciesAndDates({
      supabase,
      currencies: [...new Set(unresolvedRequests.map((r) => r.currency))],
      dateKeys: Array.from(staleWindowDateKeys),
    });

    const priorRowsByCurrency = new Map<string, CachedExchangeRateRow[]>();
    priorRows.forEach((row) => {
      const entries = priorRowsByCurrency.get(row.target_currency) ?? [];
      entries.push(row);
      priorRowsByCurrency.set(row.target_currency, entries);
    });
    priorRowsByCurrency.forEach((rows) => {
      rows.sort((a, b) => b.date.localeCompare(a.date));
    });

    unresolvedRequests.forEach((request) => {
      const candidates = priorRowsByCurrency.get(request.currency);
      if (!candidates?.length) return;

      const matched = candidates.find((candidate) =>
        isWithinStaleGuard({
          candidateDateKey: candidate.date,
          effectiveDateKey: request.effectiveDateKey,
          staleGuardDays: resolvedOptions.staleGuardDays,
        }),
      );
      if (matched) {
        results.set(request.requestedCacheKey, matched.rate);
      }
    });
  }

  unresolvedRequests = unresolvedRequests.filter(
    (request) => !results.has(request.requestedCacheKey),
  );

  // 3) Fetch unresolved rates from providers.
  if (unresolvedRequests.length > 0) {
    // Group by unique dates for frankfurter api calls
    const uniqueDates = [
      ...new Set(unresolvedRequests.map((r) => r.effectiveDateKey)),
    ];

    // Create parallel promises for each date
    const fetchPromises = uniqueDates.map(async (dateString) => {
      try {
        const missingCurrenciesForDate = [
          ...new Set(
            unresolvedRequests
              .filter((req) => req.effectiveDateKey === dateString)
              .map((req) => req.currency),
          ),
        ];

        // Try Frankfurter first
        const response = await fetch(
          `${FRANKFURTER_API}/${dateString}?base=USD&symbols=${missingCurrenciesForDate.join(",")}`,
        );
        const data = await response.json();

        const providerEntries: ProviderRateEntry[] = [];
        let missingFromFrankfurter: string[] = [];

        if (data.rates) {
          const frankfurterDateKey = resolveProviderDateKey(
            data.date,
            dateString,
          );

          missingCurrenciesForDate.forEach((currency) => {
            const rate = data.rates[currency];
            if (typeof rate !== "number" || !Number.isFinite(rate)) {
              return;
            }

            providerEntries.push({
              currency,
              rate,
              effectiveDateKey: frankfurterDateKey,
            });
          });

          // Find currencies not returned by Frankfurter
          missingFromFrankfurter = missingCurrenciesForDate.filter(
            (currency) => !(currency in data.rates),
          );
        } else {
          missingFromFrankfurter = missingCurrenciesForDate;
        }

        // Fallback API for missing currencies
        if (missingFromFrankfurter.length > 0) {
          try {
            const todayString = formatUTCDateKey(new Date());
            let fallbackDateString =
              dateString > todayString ? todayString : dateString;
            let remainingCurrencies = [...missingFromFrankfurter];

            for (
              let lookbackDays = 0;
              lookbackDays <= MAX_FALLBACK_LOOKBACK_DAYS &&
              remainingCurrencies.length > 0;
              lookbackDays += 1
            ) {
              const fallbackUrl = `${FALLBACK_API}@${fallbackDateString}/v1/currencies/usd.min.json`;
              const fallbackResponse = await fetch(fallbackUrl);

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.usd) {
                  remainingCurrencies = remainingCurrencies.filter(
                    (currency) => {
                      const lowerCurrency = currency.toLowerCase();
                      const rate = fallbackData.usd[lowerCurrency];
                      if (typeof rate === "number" && Number.isFinite(rate)) {
                        providerEntries.push({
                          currency,
                          rate,
                          effectiveDateKey: fallbackDateString,
                        });
                        return false;
                      }
                      return true;
                    },
                  );
                }
              }

              const fallbackDate = new Date(`${fallbackDateString}T00:00:00Z`);
              fallbackDate.setUTCDate(fallbackDate.getUTCDate() - 1);
              fallbackDateString = formatUTCDateKey(fallbackDate);
            }
          } catch (fallbackError) {
            console.warn(
              `Failed to fetch missing currencies from fallback API for ${dateString}:`,
              fallbackError,
            );
          }
        }

        if (providerEntries.length === 0) {
          throw new Error(`No exchange rates found for ${dateString}`);
        }

        // Return the data for this date
        return {
          requestedEffectiveDateKey: dateString,
          entries: providerEntries,
          success: true,
        };
      } catch (error) {
        console.warn(
          `Failed to fetch exchange rates for ${dateString}:`,
          error,
        );
        return { dateString, success: false };
      }
    });

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // Filter successful fetches and prepare for bulk insert
    const successfulFetches = fetchResults.filter(
      (
        result,
      ): result is {
        requestedEffectiveDateKey: string;
        entries: ProviderRateEntry[];
        success: true;
      } => result.success,
    );

    // Resolve successful provider results back to original requested keys.
    // Keep matches scoped to the same requested effective date bucket to avoid
    // cross-date bleed in multi-date batches when one date fetch fails.
    const fetchedEntriesByRequestAndCurrency = new Map<
      string,
      ProviderRateEntry
    >();
    successfulFetches.forEach(({ requestedEffectiveDateKey, entries }) => {
      entries.forEach((entry) => {
        fetchedEntriesByRequestAndCurrency.set(
          `${requestedEffectiveDateKey}|${entry.currency}`,
          entry,
        );
      });
    });

    unresolvedRequests.forEach((request) => {
      const matched = fetchedEntriesByRequestAndCurrency.get(
        `${request.effectiveDateKey}|${request.currency}`,
      );
      if (matched && matched.effectiveDateKey <= request.effectiveDateKey) {
        results.set(request.requestedCacheKey, matched.rate);
      }
    });

    if (!resolvedOptions.upsert || successfulFetches.length === 0) {
      return results;
    }

    if (successfulFetches.length > 0) {
      // Prepare all rows for bulk insert
      const rowsByCurrencyDate = new Map<
        string,
        {
          base_currency: "USD";
          target_currency: string;
          rate: number;
          date: string;
        }
      >();
      successfulFetches.forEach(({ entries }) => {
        entries.forEach((entry) => {
          rowsByCurrencyDate.set(
            `${entry.currency}|${entry.effectiveDateKey}`,
            {
              base_currency: "USD",
              target_currency: entry.currency,
              rate: Number(entry.rate),
              date: entry.effectiveDateKey,
            },
          );
        });
      });

      const allRows = Array.from(rowsByCurrencyDate.values());

      // Sort by PK components to avoid lock-order deadlocks
      allRows.sort((a, b) => {
        if (a.target_currency === b.target_currency) {
          return a.date.localeCompare(b.date);
        }
        return a.target_currency.localeCompare(b.target_currency);
      });

      // Single bulk insert into database
      const { error: insertError } = await supabase
        .from("exchange_rates")
        .upsert(allRows, { onConflict: "base_currency,target_currency,date" });

      if (insertError) {
        console.error("Failed to bulk insert exchange rates:", insertError);
      }
    }
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
  options: FetchExchangeRatesOptions = {},
) {
  const rates = await fetchExchangeRates([{ currency, date }], options);
  const key = `${currency}|${formatUTCDateKey(date)}`;
  return rates.get(key) || 1;
}
