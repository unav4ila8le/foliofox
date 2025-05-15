"use server";

import { fetchHoldings } from "@/server/holdings/fetch";

// Calculate asset allocation by category
export async function calculateAssetAllocation() {
  const holdings = await fetchHoldings();

  // Group by category and calculate totals
  const assetAllocation: Record<
    string,
    {
      category_code: string;
      name: string;
      total_value: number;
    }
  > = {};

  holdings.forEach((holding) => {
    const category_code = holding.category_code;
    const total_value = holding.current_quantity * holding.current_value;

    if (assetAllocation[category_code]) {
      assetAllocation[category_code].total_value += total_value;
    } else {
      assetAllocation[category_code] = {
        category_code,
        name: holding.asset_categories.name,
        total_value,
      };
    }
  });

  return Object.values(assetAllocation);
}
