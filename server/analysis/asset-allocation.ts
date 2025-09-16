"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

/**
 * Calculate asset allocation by category.
 * Uses bulk exchange rate fetching for optimal performance.
 */
export async function calculateAssetAllocation(targetCurrency: string) {
  const date = new Date();
  // 1. Get all holdings
  const holdings = await fetchHoldings({
    includeArchived: true,
    quoteDate: date,
  });

  if (holdings.length === 0) {
    return [];
  }

  // 2. Collect all currencies we need exchange rates for
  const holdingCurrencies = [...new Set(holdings.map((h) => h.currency))];
  const allCurrencies = [...new Set([...holdingCurrencies, targetCurrency])];

  // 3. Bulk fetch all exchange rates at once
  const exchangeRateRequests = allCurrencies.map((currency) => ({
    currency,
    date,
  }));

  const exchangeRates = await fetchExchangeRates(exchangeRateRequests);

  // 4. Convert each holding value directly to target currency
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
  const assetAllocationInTarget: Record<
    string,
    {
      category_code: string;
      name: string;
      total_value_target: number;
    }
  > = {};

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
    .sort((a, b) => b.total_value - a.total_value); // Sort by value descending;

  return assetAllocation;
}
