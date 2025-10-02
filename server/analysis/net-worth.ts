"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

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

  // 2. Fetch FX rates for conversion
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((h) => uniqueCurrencies.add(h.currency));
  uniqueCurrencies.add(targetCurrency);

  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date,
  }));

  const exchangeRates = await fetchExchangeRates(exchangeRequests);

  // 3. Sum converted values
  let netWorth = 0;
  holdings.forEach((holding) => {
    const localValue = holding.total_value;
    const convertedValue = convertCurrency(
      localValue,
      holding.currency,
      targetCurrency,
      exchangeRates,
      date,
    );
    netWorth += convertedValue;
  });

  return netWorth;
}
