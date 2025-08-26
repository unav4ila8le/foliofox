"use server";

import { format, addMonths, startOfMonth } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type { Dividend, ProjectedIncomeData } from "@/types/global.types";

/**
 * Calculate projected monthly income for user's portfolio
 */
export async function calculateProjectedIncome(
  targetCurrency: string = "USD",
  monthsAhead: number = 12,
): Promise<ProjectedIncomeData[]> {
  const holdings = await fetchHoldings({
    includeArchived: false,
    quoteDate: null,
  });

  const symbolIds = holdings
    .filter((holding) => holding.symbol_id)
    .map((holding) => holding.symbol_id!);

  if (symbolIds.length === 0) {
    return [];
  }

  const dividendsMap = await fetchDividends(
    symbolIds.map((symbolId) => ({ symbolId })),
  );

  // Collect unique currencies we need exchange rates for
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((holding) => {
    uniqueCurrencies.add(holding.currency);
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

    holdings.forEach((holding) => {
      if (!holding.symbol_id) return;

      const dividendData = dividendsMap.get(holding.symbol_id);
      if (!dividendData?.summary) return;

      const { summary } = dividendData;

      // Calculate expected dividend for this month based on frequency
      const monthlyDividend = calculateMonthlyDividend(summary, monthStart);
      const holdingDividendIncome = monthlyDividend * holding.current_quantity;

      // Convert to target currency using exchange rates
      const toUsdKey = `${holding.currency}|${format(new Date(), "yyyy-MM-dd")}`;
      const fromUsdKey = `${targetCurrency}|${format(new Date(), "yyyy-MM-dd")}`;

      const toUsdRate = exchangeRatesMap.get(toUsdKey);
      const fromUsdRate = exchangeRatesMap.get(fromUsdKey);

      if (toUsdRate && fromUsdRate) {
        const valueInUsd = holdingDividendIncome / toUsdRate;
        const convertedValue = valueInUsd * fromUsdRate;
        monthTotal += convertedValue;
      }
    });

    monthlyIncome.set(monthKey, monthTotal);
  }

  return Array.from(monthlyIncome.entries()).map(([month, income]) => ({
    date: new Date(month + "-01"),
    income,
  }));
}

/**
 * Calculate monthly dividend amount based on frequency
 */
function calculateMonthlyDividend(summary: Dividend, month: Date): number {
  if (!summary.trailing_ttm_dividend || summary.trailing_ttm_dividend <= 0) {
    return 0;
  }

  const frequency = summary.inferred_frequency;
  const annualAmount = summary.trailing_ttm_dividend;

  switch (frequency) {
    case "monthly":
      return annualAmount / 12;
    case "quarterly":
      // Check if this month aligns with quarterly pattern
      const lastPaymentMonth = summary.last_dividend_date
        ? new Date(summary.last_dividend_date).getMonth()
        : 0;
      const currentMonth = month.getMonth();
      const monthsSinceLastPayment =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPayment % 3 === 0 ? annualAmount / 4 : 0;
    case "semiannual":
      return annualAmount / 12; // Spread over 12 months
    case "annual":
      return annualAmount / 12; // Spread over 12 months
    default:
      return 0;
  }
}
