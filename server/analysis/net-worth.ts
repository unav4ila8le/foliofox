"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(),
) {
  // 1. Fetch holdings valued as-of the date (records not needed here)
  const holdings = await fetchHoldings({
    includeArchived: true,
    asOfDate: date,
  });

  if (!holdings?.length) return 0;

  // 2. Fetch only FX for conversion
  const { exchangeRates: exchangeRatesMap } = await fetchMarketData(
    holdings,
    date,
    targetCurrency,
    { include: { marketPrices: false } },
  );

  // 3. Sum converted values
  let netWorth = 0;
  holdings.forEach((holding) => {
    const localValue = holding.total_value;
    const convertedValue = convertCurrency(
      localValue,
      holding.currency,
      targetCurrency,
      exchangeRatesMap,
      date,
    );
    netWorth += convertedValue;
  });

  return netWorth;
}
