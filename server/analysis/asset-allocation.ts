"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

/**
 * Calculate asset allocation by category.
 * Uses bulk exchange rate fetching for optimal performance.
 */
export async function calculateAssetAllocation(targetCurrency: string) {
  // 1. Get all holdings
  const holdings = await fetchHoldings({ includeArchived: true });

  if (holdings.length === 0) {
    return [];
  }

  // 2. Collect all currencies we need exchange rates for
  const holdingCurrencies = [...new Set(holdings.map((h) => h.currency))];
  const allCurrencies = [...new Set([...holdingCurrencies, targetCurrency])];

  // 3. Bulk fetch all exchange rates at once
  const exchangeRateRequests = allCurrencies.map((currency) => ({
    currency,
    date: new Date(),
  }));

  const exchangeRates = await fetchExchangeRates(exchangeRateRequests);

  // 4. Convert all holdings to USD using bulk-fetched rates
  const holdingsInUSD = holdings.map((holding) => {
    const rateKey = `${holding.currency}|${new Date().toISOString().split("T")[0]}`;
    const rate = exchangeRates.get(rateKey);

    if (!rate) {
      throw new Error(`Exchange rate not found for ${holding.currency}`);
    }

    return {
      ...holding,
      total_value_usd: holding.total_value / rate,
    };
  });

  // 5. Group by category and sum USD values
  const assetAllocationInUSD: Record<
    string,
    {
      category_code: string;
      name: string;
      total_value_usd: number;
    }
  > = {};

  holdingsInUSD.forEach((holding) => {
    const category_code = holding.category_code;

    if (assetAllocationInUSD[category_code]) {
      assetAllocationInUSD[category_code].total_value_usd +=
        holding.total_value_usd;
    } else {
      assetAllocationInUSD[category_code] = {
        category_code,
        name: holding.asset_categories.name,
        total_value_usd: holding.total_value_usd,
      };
    }
  });

  // 6. Convert back to target currency (only need 1 rate, not N rates)
  const targetCurrencyRateKey = `${targetCurrency}|${new Date().toISOString().split("T")[0]}`;
  const targetRate = exchangeRates.get(targetCurrencyRateKey);

  if (!targetRate) {
    throw new Error(
      `Exchange rate not found for target currency ${targetCurrency}`,
    );
  }

  const assetAllocation = Object.values(assetAllocationInUSD).map(
    (allocation) => ({
      category_code: allocation.category_code,
      name: allocation.name,
      total_value: allocation.total_value_usd * targetRate,
    }),
  );

  return assetAllocation;
}
