"use server";

import { cache } from "react";
import { format, addMonths, startOfMonth } from "date-fns";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { resolveSymbolInput } from "@/server/symbols/resolver";

import { convertCurrency } from "@/lib/currency-conversion";
import type { PositionsQueryContext } from "@/server/positions/fetch";

import type {
  Dividend,
  DividendEvent,
  ProjectedIncomeData,
} from "@/types/global.types";

export interface ProjectedIncomeResult {
  success: boolean;
  data?: ProjectedIncomeData[];
  message?: string;
  currency?: string;
}

/**
 * Calculate projected monthly income for user's portfolio
 */
export const calculateProjectedIncome = cache(
  async (
    targetCurrency: string,
    monthsAhead: number = 12,
    context?: PositionsQueryContext,
  ) => {
    try {
      const positions = await fetchPositions(
        {
          positionType: "asset",
          includeArchived: true,
        },
        context,
      );

      const symbolIds = positions
        .filter((position) => position.symbol_id)
        .map((position) => position.symbol_id!);

      if (symbolIds.length === 0) {
        return {
          success: true,
          data: [],
          message: "No positions with market data found",
        };
      }

      const dividendsMap = await fetchDividends(
        symbolIds.map((symbolId) => ({ symbolId })),
      );

      // Check if any positions have dividend data
      const positionsWithDividends = positions.filter((position) => {
        if (!position.symbol_id) return false;
        const dividendData = dividendsMap.get(position.symbol_id);
        if (!dividendData?.summary) return false;
        if (dividendData.summary.pays_dividends === false) return false;
        return dividendData.events.length > 0;
      });

      if (positionsWithDividends.length === 0) {
        return {
          success: true,
          data: [],
          message: "No dividend-paying positions found in your portfolio",
        };
      }

      // Collect unique currencies we need exchange rates for
      const uniqueCurrencies = new Set<string>();
      positions.forEach((position) => {
        uniqueCurrencies.add(position.currency);
      });
      // Add dividend event currencies (from dividend_events table)
      dividendsMap.forEach(({ events }) => {
        events.forEach((event: DividendEvent) => {
          uniqueCurrencies.add(event.currency);
        });
      });
      uniqueCurrencies.add(targetCurrency);

      // Create exchange rate requests for unique currencies only
      const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
        currency,
        date: new Date(),
      }));

      // Fetch exchange rates
      const exchangeRatesMap = await fetchExchangeRates(exchangeRequests);

      // Calculate monthly projected income
      const monthlyIncome = new Map<string, number>();
      const today = new Date();

      for (let i = 0; i < monthsAhead; i++) {
        const monthStart = startOfMonth(addMonths(today, i));
        const monthKey = format(monthStart, "yyyy-MM");
        let monthTotal = 0;

        positions.forEach((position) => {
          if (!position.symbol_id) return;

          const dividendData = dividendsMap.get(position.symbol_id);
          if (!dividendData?.summary) return;
          if (dividendData.summary.pays_dividends === false) return;

          const { summary } = dividendData;

          // Calculate expected dividend for this month based on frequency
          const monthlyDividend = calculateMonthlyDividend(
            summary,
            monthStart,
            dividendData.events,
          );
          const positionDividendIncome =
            monthlyDividend * position.current_quantity;

          // Get the currency from dividend events (use most recent event's currency)
          const dividendCurrency =
            dividendData.events.length > 0
              ? dividendData.events[0].currency
              : position.currency;

          // Handle currency conversion
          const convertedValue = convertCurrency(
            positionDividendIncome,
            dividendCurrency,
            targetCurrency,
            exchangeRatesMap,
            format(new Date(), "yyyy-MM-dd"),
          );

          if (convertedValue !== null) {
            monthTotal += convertedValue;
          }
        });

        monthlyIncome.set(monthKey, monthTotal);
      }

      return {
        success: true,
        data: Array.from(monthlyIncome.entries()).map(([month, income]) => ({
          date: new Date(month + "-01"),
          income,
        })),
        currency: targetCurrency,
      };
    } catch (error) {
      console.error("Error calculating projected income:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to calculate projected income",
      };
    }
  },
);

/**
 * Calculate projected income for a specific symbol
 */
export async function calculateSymbolProjectedIncome(
  symbolLookup: string,
  quantity: number,
  monthsAhead: number = 12,
) {
  try {
    const resolved = await resolveSymbolInput(symbolLookup);
    if (!resolved?.symbol?.id) {
      return {
        success: false,
        data: [],
        message: `Unable to resolve symbol lookup "${symbolLookup}".`,
      };
    }

    const canonicalId = resolved.symbol.id;

    const dividendsMap = await fetchDividends([{ symbolId: canonicalId }]);
    const dividendData = dividendsMap.get(canonicalId);

    if (
      !dividendData?.summary ||
      dividendData.summary.pays_dividends === false
    ) {
      return {
        success: true,
        data: [],
        message: "This symbol does not pay dividends",
      };
    }

    if (dividendData.events.length === 0) {
      return {
        success: true,
        data: [],
        message: "No dividend history available for this symbol",
      };
    }

    // Get the symbol's currency from the dividend data
    const symbolCurrency =
      dividendData.events.length > 0 ? dividendData.events[0].currency : "USD";

    // Calculate monthly projected income in the dividend's own currency
    const monthlyIncome = new Map<string, number>();
    const today = new Date();

    for (let i = 0; i < monthsAhead; i++) {
      const monthStart = startOfMonth(addMonths(today, i));
      const monthKey = format(monthStart, "yyyy-MM");

      const { summary } = dividendData;
      const monthlyDividend = calculateMonthlyDividend(
        summary,
        monthStart,
        dividendData.events,
      );
      const symbolDividendIncome = monthlyDividend * quantity;

      // Keep the income in the dividend's own currency (no conversion)
      monthlyIncome.set(monthKey, symbolDividendIncome);
    }

    return {
      success: true,
      data: Array.from(monthlyIncome.entries()).map(([month, income]) => ({
        date: new Date(month + "-01"),
        income,
      })),
      currency: symbolCurrency,
    };
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

// Removed local convertCurrency in favor of shared helper

/**
 * Calculate monthly dividend amount based on frequency
 */
function calculateMonthlyDividend(
  summary: Dividend,
  month: Date,
  events: DividendEvent[],
): number {
  // Prefer provider amounts unless they are clearly inflated compared to payouts we observed
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentEvents = events.filter(
    (event) => new Date(event.event_date) >= oneYearAgo,
  );

  const eventAnnualAmount =
    recentEvents.length > 0
      ? recentEvents.reduce((sum, event) => sum + event.gross_amount, 0)
      : 0;

  const providerTtm = summary.trailing_ttm_dividend || 0;
  const providerForward = summary.forward_annual_dividend || 0;

  const hasEvents = eventAnnualAmount > 0;
  const ttmWithinTolerance =
    providerTtm > 0 && hasEvents
      ? providerTtm >= eventAnnualAmount * 0.9 &&
        providerTtm <= eventAnnualAmount * 1.1
      : true;

  // Keep TTM when it aligns with payouts (±10%); otherwise prefer events, then forward.
  const annualAmount =
    providerTtm > 0 && ttmWithinTolerance
      ? providerTtm
      : hasEvents
        ? eventAnnualAmount
        : providerForward > 0
          ? providerForward
          : providerTtm;

  if (!annualAmount || annualAmount <= 0) {
    return 0;
  }

  const frequency = summary.inferred_frequency;

  const lastPaymentMonth = summary.last_dividend_date
    ? new Date(summary.last_dividend_date).getMonth()
    : 0;
  const currentMonth = month.getMonth();

  switch (frequency) {
    case "monthly":
      return annualAmount / 12;
    case "quarterly":
      // Check if this month aligns with quarterly pattern
      const monthsSinceLastPayment =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPayment % 3 === 0 ? annualAmount / 4 : 0;
    case "semiannual":
      // Check if this month aligns with semiannual pattern (every 6 months)
      const monthsSinceLastPaymentSemi =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPaymentSemi % 6 === 0 ? annualAmount / 2 : 0;
    case "annual":
      // Return full annual amount only in the payment month
      return currentMonth === lastPaymentMonth ? annualAmount : 0;
    default:
      return 0;
  }
}
