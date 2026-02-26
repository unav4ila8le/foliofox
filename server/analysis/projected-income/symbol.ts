"use server";

import { addMonths, startOfMonth } from "date-fns";

import { fetchDividends } from "@/server/dividends/fetch";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { resolveSymbolInput } from "@/server/symbols/resolve";

import {
  buildDividendProjectionBasis,
  calculateMonthlyDividend,
} from "@/server/analysis/projected-income/utils";
import { formatLocalDateKey, parseLocalDateKey } from "@/lib/date/date-utils";

import type {
  Dividend,
  DividendEvent,
  ProjectedIncomeData,
} from "@/types/global.types";

interface SymbolProjectedIncomeResult {
  success: boolean;
  data?: ProjectedIncomeData[];
  message?: string;
  currency?: string;
}

interface SymbolDividendContext {
  canonicalId: string;
  summary: Dividend | null;
  events: DividendEvent[];
}

export interface SymbolProjectedIncomePanelResult {
  projectedIncome: SymbolProjectedIncomeResult;
  dividendYield: number | null;
}

const DIVIDEND_FREQUENCY_MULTIPLIER: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

async function fetchSymbolDividendContext(
  symbolLookup: string,
): Promise<SymbolDividendContext | null> {
  const resolved = await resolveSymbolInput(symbolLookup);
  if (!resolved?.symbol?.id) return null;

  const canonicalId = resolved.symbol.id;
  const dividendsMap = await fetchDividends([{ symbolId: canonicalId }]);
  const dividendData = dividendsMap.get(canonicalId);

  return {
    canonicalId,
    summary: dividendData?.summary ?? null,
    events: dividendData?.events ?? [],
  };
}

function buildProjectedIncomeResultFromDividendContext({
  summary,
  events,
  quantity,
  monthsAhead,
  unitValue,
  fallbackCurrency,
}: {
  summary: Dividend | null;
  events: DividendEvent[];
  quantity: number;
  monthsAhead: number;
  unitValue?: number;
  fallbackCurrency: string;
}): SymbolProjectedIncomeResult {
  if (!summary) {
    return {
      success: true,
      data: [],
      message: "No dividend information available for this symbol",
    };
  }

  if (summary.pays_dividends === false && events.length === 0) {
    return {
      success: true,
      data: [],
      message: "This symbol does not pay dividends",
    };
  }

  const projectionBasis = buildDividendProjectionBasis(summary, events, {
    currentUnitValue: unitValue,
    fallbackCurrency,
  });

  if (!projectionBasis) {
    return {
      success: true,
      data: [],
      message: "No dividend data available for this symbol",
    };
  }

  // 1) Build monthly projected income in dividend currency.
  const monthlyIncome = new Map<string, number>();
  const today = new Date();

  for (let i = 0; i < monthsAhead; i++) {
    const monthStart = startOfMonth(addMonths(today, i));
    const monthKey = formatLocalDateKey(monthStart).slice(0, 7);
    const monthlyDividend = calculateMonthlyDividend(
      monthStart,
      projectionBasis,
    );
    const symbolDividendIncome = monthlyDividend * quantity;

    monthlyIncome.set(monthKey, symbolDividendIncome);
  }

  // 2) Return local dates so chart rendering avoids timezone drift.
  return {
    success: true,
    data: Array.from(monthlyIncome.entries()).map(([month, income]) => ({
      date: parseLocalDateKey(`${month}-01`),
      income,
    })),
    currency: projectionBasis.currency,
  };
}

function computeAnnualDividendRate({
  summary,
  events,
}: {
  summary: Dividend;
  events: DividendEvent[];
}): number | null {
  const sortedEvents = [...events].sort(
    (a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
  );
  const latestEvent = sortedEvents[0] ?? null;

  let annualDividend =
    (summary.trailing_ttm_dividend ?? 0) > 0
      ? summary.trailing_ttm_dividend!
      : (summary.forward_annual_dividend ?? 0);

  if (annualDividend <= 0 && sortedEvents.length > 0) {
    const oneYearAgo = addMonths(new Date(), -12);
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

  if (annualDividend <= 0 && latestEvent) {
    const frequency = summary.inferred_frequency ?? "";
    const multiplier = DIVIDEND_FREQUENCY_MULTIPLIER[frequency] ?? 0;
    if (multiplier > 0) {
      annualDividend = latestEvent.gross_amount * multiplier;
    }
  }

  return annualDividend > 0 ? annualDividend : null;
}

async function resolvePriceForYield(
  canonicalId: string,
  unitValue?: number,
): Promise<number | null> {
  if (typeof unitValue === "number" && unitValue > 0) {
    return unitValue;
  }

  try {
    const latestQuote = await fetchSingleQuote(canonicalId, {
      upsert: false,
      liveFetchOnMiss: false,
    });
    if (typeof latestQuote === "number" && latestQuote > 0) {
      return latestQuote;
    }
  } catch (error) {
    console.warn(
      `Failed to fetch price while estimating dividend yield (${canonicalId}):`,
      error,
    );
  }

  return null;
}

async function computeDividendYieldFromDividendContext({
  canonicalId,
  summary,
  events,
  unitValue,
}: {
  canonicalId: string;
  summary: Dividend | null;
  events: DividendEvent[];
  unitValue?: number;
}): Promise<number | null> {
  if (!summary || summary.pays_dividends === false) {
    return null;
  }

  const reportedYield =
    summary.dividend_yield && summary.dividend_yield > 0
      ? summary.dividend_yield
      : null;

  if (reportedYield) {
    return reportedYield;
  }

  const annualDividendRate = computeAnnualDividendRate({ summary, events });
  if (!annualDividendRate) {
    return null;
  }

  const price = await resolvePriceForYield(canonicalId, unitValue);
  if (!price) {
    return null;
  }

  return annualDividendRate / price;
}

/**
 * Calculates projected income for a single symbol.
 */
export async function calculateSymbolProjectedIncome(
  symbolLookup: string,
  quantity: number,
  monthsAhead: number = 12,
  unitValue?: number,
  fallbackCurrency: string = "USD",
) {
  try {
    const dividendContext = await fetchSymbolDividendContext(symbolLookup);
    if (!dividendContext) {
      return {
        success: false,
        data: [],
        message: `Unable to resolve symbol lookup "${symbolLookup}".`,
      };
    }

    return buildProjectedIncomeResultFromDividendContext({
      summary: dividendContext.summary,
      events: dividendContext.events,
      quantity,
      monthsAhead,
      unitValue,
      fallbackCurrency,
    });
  } catch (error) {
    console.error(
      "Error calculating projected income for %s:",
      symbolLookup,
      error,
    );
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to calculate projected income",
    };
  }
}

/**
 * Calculates both projected income and dividend yield for one symbol in one pass.
 */
export async function calculateSymbolProjectedIncomePanelData(
  symbolLookup: string,
  quantity: number,
  monthsAhead: number = 12,
  unitValue?: number,
  fallbackCurrency: string = "USD",
): Promise<SymbolProjectedIncomePanelResult> {
  try {
    const dividendContext = await fetchSymbolDividendContext(symbolLookup);
    if (!dividendContext) {
      return {
        projectedIncome: {
          success: false,
          data: [],
          message: `Unable to resolve symbol lookup "${symbolLookup}".`,
        },
        dividendYield: null,
      };
    }

    const projectedIncome = buildProjectedIncomeResultFromDividendContext({
      summary: dividendContext.summary,
      events: dividendContext.events,
      quantity,
      monthsAhead,
      unitValue,
      fallbackCurrency,
    });

    const dividendYield = await computeDividendYieldFromDividendContext({
      canonicalId: dividendContext.canonicalId,
      summary: dividendContext.summary,
      events: dividendContext.events,
      unitValue,
    });

    return { projectedIncome, dividendYield };
  } catch (error) {
    console.error(
      "Error calculating projected income panel data for %s:",
      symbolLookup,
      error,
    );
    return {
      projectedIncome: {
        success: false,
        data: [],
        message:
          error instanceof Error
            ? error.message
            : "Failed to calculate projected income",
      },
      dividendYield: null,
    };
  }
}
