"use server";

import { format, subYears, subDays } from "date-fns";
import YahooFinance from "yahoo-finance2";

import { createServiceClient } from "@/supabase/service";

import type { Dividend, DividendEvent } from "@/types/global.types";

// Initialize yahooFinance with v3 pattern
const yahooFinance = new YahooFinance();

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

  const results = new Map<
    string,
    { events: DividendEvent[]; summary: Dividend }
  >();
  const supabase = createServiceClient();
  const symbolIds = [...new Set(requests.map((r) => r.symbolId))];

  // 1. Check database cache first
  if (upsert) {
    const [cachedEvents, cachedSummaries] = await Promise.all([
      supabase
        .from("dividend_events")
        .select("*")
        .in("symbol_id", symbolIds)
        .gte("event_date", subYears(new Date(), 3).toISOString()),
      supabase
        .from("dividends")
        .select("*")
        .in("symbol_id", symbolIds)
        .gte("updated_at", subDays(new Date(), 30).toISOString()),
    ]);

    // Group cached results by symbol
    const eventsBySymbol = new Map<string, DividendEvent[]>();
    cachedEvents.data?.forEach((event) => {
      const existing = eventsBySymbol.get(event.symbol_id) || [];
      existing.push(event);
      eventsBySymbol.set(event.symbol_id, existing);
    });

    const summariesBySymbol = new Map<string, Dividend>();
    cachedSummaries.data?.forEach((summary) => {
      summariesBySymbol.set(summary.symbol_id, summary);
    });

    // Check which symbols have sufficient cache
    symbolIds.forEach((symbolId) => {
      const events = eventsBySymbol.get(symbolId) || [];
      const summary = summariesBySymbol.get(symbolId);

      if (events.length > 0 && summary) {
        results.set(symbolId, { events, summary });
      }
    });
  }

  // 2. Find symbols that need fresh data
  const missingSymbols = symbolIds.filter((symbolId) => !results.has(symbolId));

  // 3. Fetch missing dividend data from Yahoo Finance
  if (missingSymbols.length > 0) {
    const fetchPromises = missingSymbols.map(async (symbolId) => {
      try {
        // Use the efficient 2-call approach
        const [summary, chart] = await Promise.all([
          yahooFinance.quoteSummary(symbolId, {
            modules: ["summaryDetail", "calendarEvents"],
          }),
          yahooFinance.chart(symbolId, {
            period1: subYears(new Date(), 3),
            period2: new Date(),
            events: "div",
          }),
        ]);

        // Process events from chart
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

        // Calculate derived fields from events
        const inferred_frequency = detectDividendFrequency(events);
        const last_dividend_date =
          events.length > 0
            ? events.sort(
                (a, b) =>
                  new Date(b.event_date).getTime() -
                  new Date(a.event_date).getTime(),
              )[0].event_date
            : null;

        // Only create dividend summary if the symbol actually pays dividends
        const hasDividendData =
          summary.summaryDetail?.dividendRate ||
          summary.summaryDetail?.trailingAnnualDividendRate ||
          summary.summaryDetail?.dividendYield ||
          (chart.events?.dividends && chart.events.dividends.length > 0);

        // Build summary with calculated fields
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
        } else {
          // Return null summary for non-dividend stocks
          return { symbolId, events, summary: null };
        }
      } catch (error) {
        console.warn(`Failed to fetch dividends for ${symbolId}:`, error);
        return { symbolId, events: [], summary: null };
      }
    });

    const fetchResults = await Promise.all(fetchPromises);

    // 4. Process and cache results
    const allEvents: DividendEvent[] = [];
    const allSummaries: Dividend[] = [];

    fetchResults.forEach(({ symbolId, events, summary }) => {
      if (events.length > 0 || summary) {
        results.set(symbolId, { events, summary: summary! });
        allEvents.push(...events);
        if (summary) allSummaries.push(summary);
      }
    });

    // 5. Bulk upsert to database
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

  return results;
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
