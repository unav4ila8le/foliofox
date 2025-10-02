"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

/**
 * Calculate asset allocation by category at a specific date.
 * Uses bulk market data fetching for optimal performance.
 */
export async function calculateAssetAllocation(
  targetCurrency: string,
  date: Date = new Date(),
) {
  // 1. Fetch holdings valued as-of date (no records required)
  const holdings = await fetchHoldings({
    includeArchived: true,
    asOfDate: date,
  });

  if (!holdings?.length) {
    return [];
  }

  // 2. Fetch FX rates for conversion
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((h) => uniqueCurrencies.add(h.currency));
  uniqueCurrencies.add(targetCurrency);

  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date,
  }));

  const exchangeRates = await fetchExchangeRates(exchangeRequests);

  // 3. Convert each holding's local total value to target currency
  const holdingsInTarget = holdings.map((holding) => ({
    ...holding,
    total_value_target: convertCurrency(
      holding.total_value,
      holding.currency,
      targetCurrency,
      exchangeRates,
      date,
    ),
  }));

  // 5. Group by category and sum target-currency values
  const assetAllocationInTarget: {
    [key: string]: {
      category_code: string;
      name: string;
      total_value_target: number;
    };
  } = {};

  holdingsInTarget.forEach((holding) => {
    const category_code = holding.category_code;

    if (assetAllocationInTarget[category_code]) {
      assetAllocationInTarget[category_code].total_value_target +=
        holding.total_value_target;
    } else {
      assetAllocationInTarget[category_code] = {
        category_code,
        name: holding.asset_categories.name,
        total_value_target: holding.total_value_target,
      };
    }
  });

  const assetAllocation = Object.values(assetAllocationInTarget)
    .map((allocation) => ({
      category_code: allocation.category_code,
      name: allocation.name,
      total_value: allocation.total_value_target,
    }))
    .sort((a, b) => b.total_value - a.total_value); // Sort by value descending

  return assetAllocation;
}
