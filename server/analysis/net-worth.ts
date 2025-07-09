"use server";

import { format } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type { Record } from "@/types/global.types";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(),
) {
  const result = await fetchHoldings({
    includeArchived: true,
    quoteDate: null,
    includeRecords: true,
  });

  const { holdings, records: recordsByHolding } = result;

  if (!holdings?.length) return 0;

  // 1. Collect all requests we need to make
  const quoteRequests: Array<{ symbolId: string; date: Date }> = [];

  // Collect quote requests (only for holdings with symbols)
  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      quoteRequests.push({
        symbolId: holding.symbol_id,
        date: date,
      });
    }
  });

  // Collect unique currencies we need exchange rates for
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((holding) => {
    uniqueCurrencies.add(holding.currency);
  });
  uniqueCurrencies.add(targetCurrency);

  // Create exchange rate requests for unique currencies only
  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date: date,
  }));

  // 2. Make bulk requests in parallel
  const [quotesMap, exchangeRatesMap] = await Promise.all([
    // Bulk fetch all quotes
    quoteRequests.length > 0 ? fetchQuotes(quoteRequests) : new Map(),

    // Bulk fetch all exchange rates
    exchangeRequests.length > 0
      ? fetchExchangeRates(exchangeRequests)
      : new Map(),
  ]);

  // 3. Process historical records (already fetched by fetchHoldings)
  const latestRecords = new Map<
    string,
    Pick<
      Record,
      "holding_id" | "unit_value" | "quantity" | "date" | "created_at"
    >
  >();

  // Filter records by date and get the latest for each holding
  holdings.forEach((holding) => {
    const holdingRecords = recordsByHolding.get(holding.id) || [];
    const recordsForDate = holdingRecords.filter(
      (record: Record) => record.date <= format(date, "yyyy-MM-dd"),
    );

    if (recordsForDate.length > 0) {
      latestRecords.set(holding.id, recordsForDate[0]); // First one is latest due to sorting
    }
  });

  // 4. Calculate net worth using bulk data
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

    const valueInUsd = holdingValue / toUsdRate;
    const convertedValue = valueInUsd * fromUsdRate;

    netWorth += convertedValue;
  });

  return netWorth;
}
