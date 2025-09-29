"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchDomainValuations } from "@/server/domain-valuations/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
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

  // 2. Collect all requests we need to make
  const allQuoteRequests: Array<{ symbolId: string; date: Date }> = [];
  const allDomainRequests: Array<{ domain: string; date: Date }> = [];

  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      weeklyDates.forEach((date) => {
        allQuoteRequests.push({
          symbolId: holding.symbol_id!,
          date: date,
        });
      });
    }
    if (holding.domain_id) {
      weeklyDates.forEach((date) => {
        allDomainRequests.push({
          domain: holding.domain_id!,
          date: date,
        });
      });
    }
  });

  // Collect unique currencies we need exchange rates for
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

  // 3. Make bulk requests in parallel
  const [allQuotesMap, allDomainValuationsMap, allExchangeRatesMap] =
    await Promise.all([
      // Bulk fetch all quotes
      allQuoteRequests.length > 0 ? fetchQuotes(allQuoteRequests) : new Map(),

      // Bulk fetch all domain valuations
      allDomainRequests.length > 0
        ? fetchDomainValuations(allDomainRequests)
        : new Map(),

      // Bulk fetch all exchange rates
      allExchangeRequests.length > 0
        ? fetchExchangeRates(allExchangeRequests)
        : new Map(),
    ]);

  // 4. Process each date using the bulk data
  const history = weeklyDates.map((date) => {
    const netWorth = calculateNetWorthForDate(
      date,
      targetCurrency,
      holdings,
      recordsByHolding,
      allQuotesMap,
      allDomainValuationsMap,
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
