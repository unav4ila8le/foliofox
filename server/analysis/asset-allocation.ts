"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRate } from "@/server/exchange-rates/fetch";

// Calculate asset allocation by category
export async function calculateAssetAllocation(targetCurrency: string) {
  const holdings = await fetchHoldings({ includeArchived: true });

  // Convert all holdings to USD and calculate their values
  const holdingsInUSD = await Promise.all(
    holdings.map(async (holding) => {
      const rate = await fetchExchangeRate(holding.currency);
      return {
        ...holding,
        total_value_usd: holding.total_value / rate,
      };
    }),
  );

  // Group by category and sum USD values
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

  // Convert back to target currency
  const assetAllocation = await Promise.all(
    Object.values(assetAllocationInUSD).map(async (allocation) => {
      const rate = await fetchExchangeRate(targetCurrency);
      return {
        category_code: allocation.category_code,
        name: allocation.name,
        total_value: allocation.total_value_usd * rate,
      };
    }),
  );

  return assetAllocation;
}
