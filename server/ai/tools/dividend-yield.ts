"use server";

import { fetchDividends } from "@/server/dividends/fetch";
import { fetchSingleQuote } from "@/server/quotes/fetch";

import type { Dividend, DividendEvent } from "@/types/global.types";

type GetDividendYieldParams = {
  symbolId: string;
  includeHistory?: boolean | null;
};

type DividendEntry = {
  summary: Dividend | null;
  events: Array<DividendEvent>;
};

type DividendHistoryItem = {
  eventDate: string;
  grossAmount: number;
  currency: string;
};

export async function getDividendYield({
  symbolId,
  includeHistory,
}: GetDividendYieldParams) {
  if (!symbolId.trim()) {
    throw new Error("symbolId is required");
  }

  // Pull cached or freshly fetched dividend data for this symbol
  const dividendsMap = await fetchDividends([{ symbolId }], false);
  const entry = dividendsMap.get(symbolId) as DividendEntry | undefined;

  if (!entry || !entry.summary) {
    return {
      symbolId,
      paysDividends: false,
      summary: null,
      events: [],
      metadata: {
        retrievedAt: new Date().toISOString(),
        source: "yahoo-finance",
      },
      message:
        "No recent dividend information is available for this symbol. It may not currently pay dividends.",
    };
  }

  const { summary, events } = entry;

  // Sort events so the newest payout is first
  const sortedEvents = events
    .slice()
    .sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
    );

  const latestEvent = sortedEvents[0] ?? null;

  // Prefer Yahoo-provided annual figures when available
  let annualDividend =
    (summary.trailing_ttm_dividend ?? 0) > 0
      ? summary.trailing_ttm_dividend!
      : (summary.forward_annual_dividend ?? 0);

  // Fall back to the sum of dividends paid in the last year
  if (annualDividend <= 0 && sortedEvents.length > 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentEvents = sortedEvents.filter(
      (event) => new Date(event.event_date) >= oneYearAgo,
    );

    const totalRecent = recentEvents.reduce(
      (sum, event) => sum + event.gross_amount,
      0,
    );

    if (totalRecent > 0) {
     annualDividend = totalRecent;
    }
  }

  // Last resort: estimate using the most recent payout and frequency
  if (annualDividend <= 0 && latestEvent) {
    const multiplier: Record<string, number> = {
      monthly: 12,
      quarterly: 4,
      semiannual: 2,
      annual: 1,
    };
    const inferred = summary.inferred_frequency ?? "";
    const frequencyMultiplier = multiplier[inferred] ?? 0;
    if (frequencyMultiplier > 0) {
      annualDividend = latestEvent.gross_amount * frequencyMultiplier;
    }
  }

  let estimatedDividendYield: number | null = null;
  let latestPrice: number | null = null;

  // Estimate yield only if Yahoo did not provide one
  if (
    annualDividend > 0 &&
    (!summary.dividend_yield || summary.dividend_yield <= 0)
  ) {
    const fetchedPrice = await fetchSingleQuote(symbolId, {
      upsert: false,
    });
    if (typeof fetchedPrice === "number" && fetchedPrice > 0) {
      latestPrice = fetchedPrice;
      estimatedDividendYield = annualDividend / fetchedPrice;
    }
  }

  // Populate latest price for metadata even if no estimate was needed
  if (latestPrice === null) {
    const fallbackPrice = await fetchSingleQuote(symbolId, { upsert: false });
    if (typeof fallbackPrice === "number" && fallbackPrice > 0) {
      latestPrice = fallbackPrice;
    }
  }

  const resolvedYield =
    summary.dividend_yield && summary.dividend_yield > 0
      ? summary.dividend_yield
      : estimatedDividendYield && estimatedDividendYield > 0
        ? estimatedDividendYield
        : null;

  const yieldSource =
    // Track where the yield number came from for transparency
    summary.dividend_yield && summary.dividend_yield > 0
      ? "reported"
      : estimatedDividendYield && estimatedDividendYield > 0
        ? "estimated"
        : "unavailable";

  const annualDividendRate =
    annualDividend && annualDividend > 0 ? annualDividend : null;

  const historyEvents: DividendHistoryItem[] = includeHistory
    ? sortedEvents.slice(0, 12).map((event) => ({
        eventDate: event.event_date,
        grossAmount: event.gross_amount,
        currency: event.currency,
      }))
    : [];

  // Return headline metrics plus optional history for richer answers
  const response = {
    symbolId,
    paysDividends: true,
    summary: {
      dividendYield: resolvedYield,
      dividendYieldSource: yieldSource,
      forwardAnnualDividend: summary.forward_annual_dividend,
      trailingTTMDividend: summary.trailing_ttm_dividend,
      exDividendDate: summary.ex_dividend_date,
      lastDividendDate:
        summary.last_dividend_date ?? latestEvent?.event_date ?? null,
      inferredFrequency: summary.inferred_frequency,
      updatedAt: summary.updated_at,
      lastDividendAmount: latestEvent?.gross_amount ?? null,
      lastDividendCurrency: latestEvent?.currency ?? null,
      annualDividendRate,
      latestPrice,
    },
    events: historyEvents,
    metadata: {
      retrievedAt: new Date().toISOString(),
      source: "yahoo-finance",
    },
  };
  return response;
}
