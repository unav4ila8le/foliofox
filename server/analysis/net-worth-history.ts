"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type { Record, TransformedHolding } from "@/types/global.types";

export interface NetWorthHistoryData {
  date: Date;
  value: number;
}

interface FetchNetWorthHistoryParams {
  targetCurrency?: string;
  weeksBack?: number;
}

/**
 * Calculate net worth history over multiple weeks.
 * Uses bulk API calls for optimal performance across all historical dates.
 */
export async function fetchNetWorthHistory({
  targetCurrency,
  weeksBack = 24,
}: FetchNetWorthHistoryParams) {
  // Get user's preferred currency if not specified
  if (!targetCurrency) {
    const { profile } = await fetchProfile();
    targetCurrency = profile.display_currency;
  }

  // Generate weekly date points
  const weeklyDates = generateWeeklyDates(weeksBack);

  // 1. Fetch holdings data once
  const result = await fetchHoldings({
    includeArchived: true,
    includeRecords: true,
  });

  const { holdings, records: recordsByHolding } = result;

  if (!holdings?.length) {
    return weeklyDates.map((date) => ({ date, value: 0 }));
  }

  // 2. Collect ALL quote requests for ALL dates
  const allQuoteRequests: Array<{ symbolId: string; date: Date }> = [];
  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      weeklyDates.forEach((date) => {
        allQuoteRequests.push({
          symbolId: holding.symbol_id!,
          date: date,
        });
      });
    }
  });

  // 3. Collect ALL exchange rate requests for ALL dates
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((holding) => {
    uniqueCurrencies.add(holding.currency);
  });
  uniqueCurrencies.add(targetCurrency);

  const allExchangeRequests: Array<{ currency: string; date: Date }> = [];
  Array.from(uniqueCurrencies).forEach((currency) => {
    weeklyDates.forEach((date) => {
      allExchangeRequests.push({ currency, date });
    });
  });

  // 4. Make 2 bulk requests for ALL data needed
  const [allQuotesMap, allExchangeRatesMap] = await Promise.all([
    allQuoteRequests.length > 0 ? fetchQuotes(allQuoteRequests) : new Map(),
    allExchangeRequests.length > 0
      ? fetchExchangeRates(allExchangeRequests)
      : new Map(),
  ]);

  // 5. Process each date using the bulk data
  const history = weeklyDates.map((date) => {
    const netWorth = calculateNetWorthForDate(
      date,
      targetCurrency,
      holdings,
      recordsByHolding,
      allQuotesMap,
      allExchangeRatesMap,
    );

    return {
      date: date,
      value: netWorth,
    };
  });

  return history;
}

/**
 * Calculate net worth for a specific date using pre-fetched bulk data.
 * Avoids redundant API calls by reusing quotes and exchange rates.
 */
function calculateNetWorthForDate(
  date: Date,
  targetCurrency: string,
  holdings: TransformedHolding[],
  recordsByHolding: Map<string, Record[]>,
  quotesMap: Map<string, number>,
  exchangeRatesMap: Map<string, number>,
): number {
  // 1. Process historical records for this specific date
  const latestRecords = new Map<
    string,
    Pick<
      Record,
      "holding_id" | "unit_value" | "quantity" | "date" | "created_at"
    >
  >();

  holdings.forEach((holding) => {
    const holdingRecords = recordsByHolding.get(holding.id) || [];
    const recordsForDate = holdingRecords.filter(
      (record: Record) => record.date <= format(date, "yyyy-MM-dd"),
    );

    if (recordsForDate.length > 0) {
      latestRecords.set(holding.id, recordsForDate[0]);
    }
  });

  // 2. Calculate net worth using bulk data
  let netWorth = 0;

  holdings.forEach((holding) => {
    const record = latestRecords.get(holding.id);
    if (!record) return;

    let unitValue = record.unit_value;

    // Use market quote if available
    if (holding.symbol_id) {
      const quoteKey = `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
      const marketPrice = quotesMap.get(quoteKey);
      if (marketPrice) {
        unitValue = marketPrice;
      }
    }

    const holdingValue = unitValue * record.quantity;

    // Convert to target currency using bulk exchange rates
    const toUsdKey = `${holding.currency}|${format(date, "yyyy-MM-dd")}`;
    const fromUsdKey = `${targetCurrency}|${format(date, "yyyy-MM-dd")}`;

    const toUsdRate = exchangeRatesMap.get(toUsdKey);
    const fromUsdRate = exchangeRatesMap.get(fromUsdKey);

    if (toUsdRate && fromUsdRate) {
      const valueInUsd = holdingValue / toUsdRate;
      const convertedValue = valueInUsd * fromUsdRate;
      netWorth += convertedValue;
    }
  });

  return netWorth;
}

// Helper function to generate weekly dates
function generateWeeklyDates(weeksBack: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();

  // Simply go back 7 days at a time from today
  for (let i = 0; i < weeksBack; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - i * 7);
    dates.unshift(weekDate); // Add to beginning so dates are chronological
  }

  return dates;
}
