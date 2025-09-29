"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";
import { convertCurrency } from "@/lib/currency-conversion";

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

  // 2. Fetch market data per date using the centralized aggregator and compute values
  const history = await Promise.all(
    weeklyDates.map(async (date) => {
      // Fetch market data
      const { quotes, domainValuations, exchangeRates } = await fetchMarketData(
        holdings,
        date,
        targetCurrency,
      );

      // Calculate net worth
      const netWorth = calculateNetWorthForDate(
        date,
        targetCurrency,
        holdings,
        recordsByHolding,
        quotes,
        domainValuations,
        exchangeRates,
      );

      return {
        date: date,
        value: netWorth,
      };
    }),
  );

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
  domainValuationsMap: Map<string, number>,
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

    // Use domain valuation if available
    if (holding.domain_id) {
      const domainKey = `${holding.domain_id}|${format(date, "yyyy-MM-dd")}`;
      const domainValuation = domainValuationsMap.get(domainKey);
      if (domainValuation) {
        unitValue = domainValuation;
      }
    }

    const holdingValue = unitValue * record.quantity;

    // Convert to target currency using shared helper
    const convertedValue = convertCurrency(
      holdingValue,
      holding.currency,
      targetCurrency,
      exchangeRatesMap,
      date,
    );
    netWorth += convertedValue;
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
