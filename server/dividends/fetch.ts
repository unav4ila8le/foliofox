"use server";

import { format, subYears, subDays } from "date-fns";

import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import { resolveSymbolsBatch } from "@/server/symbols/resolver";

import type { Dividend, DividendEvent } from "@/types/global.types";

/**
 * Fetch dividend data for multiple symbols in bulk.
 * @param requests - Array of {symbolId} objects
 * @param upsert - Whether to cache results in database (defaults to true)
 * @returns Map where key is symbolId and value is {events, summary} objects
 */
export async function fetchDividends(
  requests: Array<{ symbolId: string }>,
  upsert: boolean = true,
) {
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

  if (upsert) {
    const [cachedEvents, cachedSummaries] = await Promise.all([
      supabase
        .from("dividend_events")
        .select("*")
        .in("symbol_id", canonicalIds)
        .gte("event_date", subYears(new Date(), 3).toISOString()),
      supabase
        .from("dividends")
        .select("*")
        .in("symbol_id", canonicalIds)
        .gte("updated_at", subDays(new Date(), 30).toISOString()),
    ]);

    const eventsBySymbol = new Map<string, DividendEvent[]>();
    cachedEvents.data?.forEach((event: DividendEvent) => {
      const existing = eventsBySymbol.get(event.symbol_id) || [];
      existing.push(event);
      eventsBySymbol.set(event.symbol_id, existing);
    });

    const summariesBySymbol = new Map<string, Dividend>();
    cachedSummaries.data?.forEach((summary: Dividend) => {
      summariesBySymbol.set(summary.symbol_id, summary);
    });

    canonicalIds.forEach((symbolId) => {
      const events = eventsBySymbol.get(symbolId) || [];
      const summary = summariesBySymbol.get(symbolId);

      if (events.length > 0 && summary) {
        canonicalResults.set(symbolId, { events, summary });
      }
    });
  }

  const missingCanonicalIds = canonicalIds.filter(
    (symbolId) => !canonicalResults.has(symbolId),
  );

  if (missingCanonicalIds.length > 0) {
    // 3) Fetch missing dividend data from Yahoo Finance (bulk per canonical symbol)
    const fetchPromises = missingCanonicalIds.map(async (symbolId) => {
      const resolution = byCanonicalId.get(symbolId);
      const yahooTicker = resolution?.providerAlias;
      if (!yahooTicker) {
        console.warn(
          `Skipping dividend fetch for ${symbolId}: missing Yahoo ticker alias.`,
        );
        return { symbolId, events: [], summary: null as Dividend | null };
      }

      try {
        const [summary, chart] = await Promise.all([
          yahooFinance.quoteSummary(yahooTicker, {
            modules: ["summaryDetail", "calendarEvents"],
          }),
          yahooFinance.chart(yahooTicker, {
            period1: subYears(new Date(), 3),
            period2: new Date(),
            events: "div",
          }),
        ]);

        const events: DividendEvent[] = [];
        if (chart.events?.dividends) {
          chart.events.dividends.forEach((dividend) => {
            events.push({
              id: crypto.randomUUID(),
              symbol_id: symbolId,
              event_date: format(dividend.date, "yyyy-MM-dd"),
              gross_amount: dividend.amount,
              currency: chart.meta.currency || "USD",
              source: "yahoo",
              created_at: new Date().toISOString(),
            });
          });
        }

        const inferred_frequency = detectDividendFrequency(events);
        const last_dividend_date =
          events.length > 0
            ? events.sort(
                (a, b) =>
                  new Date(b.event_date).getTime() -
                  new Date(a.event_date).getTime(),
              )[0].event_date
            : null;

        const hasDividendData =
          summary.summaryDetail?.dividendRate ||
          summary.summaryDetail?.trailingAnnualDividendRate ||
          summary.summaryDetail?.dividendYield ||
          (chart.events?.dividends && chart.events.dividends.length > 0);

        if (hasDividendData) {
          const summaryData: Dividend = {
            symbol_id: symbolId,
            forward_annual_dividend:
              summary.summaryDetail?.dividendRate || null,
            trailing_ttm_dividend:
              summary.summaryDetail?.trailingAnnualDividendRate || null,
            dividend_yield: summary.summaryDetail?.dividendYield || null,
            ex_dividend_date: summary.calendarEvents?.exDividendDate
              ? format(summary.calendarEvents.exDividendDate, "yyyy-MM-dd")
              : null,
            last_dividend_date,
            inferred_frequency,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          return { symbolId, events, summary: summaryData };
        }

        return { symbolId, events, summary: null as Dividend | null };
      } catch (error) {
        console.warn(
          `Failed to fetch dividends for ${symbolId} (${yahooTicker}):`,
          error,
        );
        return { symbolId, events: [], summary: null as Dividend | null };
      }
    });

    const fetchResults = await Promise.all(fetchPromises);

    const allEvents: DividendEvent[] = [];
    const allSummaries: Dividend[] = [];

    fetchResults.forEach(({ symbolId, events, summary }) => {
      if (events.length > 0) {
        allEvents.push(...events);
      }

      if (summary) {
        canonicalResults.set(symbolId, { events, summary });
        allSummaries.push(summary);
      }
    });

    if (upsert) {
      await Promise.all([
        allEvents.length > 0
          ? supabase
              .from("dividend_events")
              .upsert(allEvents, { onConflict: "symbol_id,event_date" })
          : null,
        allSummaries.length > 0
          ? supabase
              .from("dividends")
              .upsert(allSummaries, { onConflict: "symbol_id" })
          : null,
      ]);
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
  const sortedEvents = events.sort(
    (a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

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
