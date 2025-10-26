"use server";

import { calculateSymbolDividendYield } from "@/server/analysis/dividend-yield";

type GetDividendYieldParams = {
  symbolId: string;
  includeHistory?: boolean | null;
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

  const analytics = await calculateSymbolDividendYield(symbolId);

  if (!analytics.paysDividends) {
    return {
      symbolId: analytics.symbolId,
      paysDividends: false,
      summary: null,
      events: [],
      metadata: {
        retrievedAt: analytics.retrievedAt,
        source: "yahoo-finance",
      },
      message:
        analytics.message ??
        "No recent dividend information is available for this symbol. It may not currently pay dividends.",
    };
  }

  const historyEvents: DividendHistoryItem[] =
    includeHistory && analytics.events.length > 0
      ? analytics.events.slice(0, 12).map((event) => ({
          eventDate: event.event_date,
          grossAmount: event.gross_amount,
          currency: event.currency,
        }))
      : [];

  return {
    symbolId: analytics.symbolId,
    paysDividends: true,
    summary: {
      dividendYield: analytics.dividendYield,
      dividendYieldSource: analytics.dividendYieldSource,
      forwardAnnualDividend: analytics.summary?.forward_annual_dividend ?? null,
      trailingTTMDividend: analytics.summary?.trailing_ttm_dividend ?? null,
      exDividendDate: analytics.summary?.ex_dividend_date ?? null,
      lastDividendDate: analytics.lastDividend.date,
      inferredFrequency: analytics.summary?.inferred_frequency ?? null,
      updatedAt: analytics.summary?.updated_at ?? new Date().toISOString(),
      lastDividendAmount: analytics.lastDividend.amount,
      lastDividendCurrency: analytics.lastDividend.currency,
      annualDividendRate: analytics.annualDividendRate,
      latestPrice: analytics.latestPrice,
    },
    events: historyEvents,
    metadata: {
      retrievedAt: analytics.retrievedAt,
      source: "yahoo-finance",
    },
  };
}
