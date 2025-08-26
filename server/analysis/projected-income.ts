"use server";

import { format, addMonths, startOfMonth } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type {
  Dividend,
  DividendEvent,
  ProjectedIncomeData,
} from "@/types/global.types";

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

    holdings.forEach((holding) => {
      if (!holding.symbol_id) return;

      const dividendData = dividendsMap.get(holding.symbol_id);
      if (!dividendData?.summary) return;

      const { summary } = dividendData;

      // Calculate expected dividend for this month based on frequency
      const monthlyDividend = calculateMonthlyDividend(
        summary,
        monthStart,
        dividendData.events,
      );
      const holdingDividendIncome = monthlyDividend * holding.current_quantity;

      // Get the currency from dividend events (use most recent event's currency)
      const dividendCurrency =
        dividendData.events.length > 0
          ? dividendData.events[0].currency
          : holding.currency;

      // Handle currency conversion
      const convertedValue = convertCurrency(
        holdingDividendIncome,
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

  return Array.from(monthlyIncome.entries()).map(([month, income]) => ({
    date: new Date(month + "-01"),
    income,
  }));
}

/**
 * Convert amount from source currency to target currency using USD as base
 */
function convertCurrency(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  exchangeRatesMap: Map<string, number>,
  date: string,
): number | null {
  // If currencies are the same, no conversion needed
  if (sourceCurrency === targetCurrency) {
    return amount;
  }

  // Get exchange rates
  const toUsdKey = `${sourceCurrency}|${date}`;
  const fromUsdKey = `${targetCurrency}|${date}`;

  const toUsdRate = exchangeRatesMap.get(toUsdKey);
  const fromUsdRate = exchangeRatesMap.get(fromUsdKey);

  if (!toUsdRate || !fromUsdRate) {
    console.warn(
      `Missing exchange rates for ${sourceCurrency} or ${targetCurrency} on ${date}`,
    );
    return null;
  }

  // Convert: source -> USD -> target
  const valueInUsd = amount / toUsdRate;
  const convertedValue = valueInUsd * fromUsdRate;

  return convertedValue;
}

/**
 * Calculate monthly dividend amount based on frequency
 */
function calculateMonthlyDividend(
  summary: Dividend,
  month: Date,
  events: DividendEvent[],
): number {
  // Try to get annual dividend amount from summary first
  let annualAmount =
    summary.trailing_ttm_dividend || summary.forward_annual_dividend;

  // If summary data is missing, calculate from historical events
  if (!annualAmount || annualAmount <= 0) {
    if (events.length > 0) {
      // Calculate average annual dividend from last 12 months of events
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const recentEvents = events.filter(
        (event) => new Date(event.event_date) >= oneYearAgo,
      );

      if (recentEvents.length > 0) {
        const totalAmount = recentEvents.reduce(
          (sum, event) => sum + event.gross_amount,
          0,
        );
        annualAmount = totalAmount; // This is the total paid in the last year
      }
    }
  }

  if (!annualAmount || annualAmount <= 0) {
    return 0;
  }

  const frequency = summary.inferred_frequency;

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
