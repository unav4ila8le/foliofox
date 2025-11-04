"use server";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";
import type { PositionsQueryContext } from "@/server/positions/fetch";

/**
 * Calculate asset allocation by category at a specific date.
 * Uses bulk market data fetching for optimal performance.
 */
export async function calculateAssetAllocation(
  targetCurrency: string,
  date: Date = new Date(),
  context?: PositionsQueryContext,
) {
  // 1. Fetch positions valued as-of date (no snapshots histories needed)
  const positions = await fetchPositions(
    {
      positionType: "asset",
      includeArchived: true,
      asOfDate: date,
    },
    context,
  );

  if (!positions?.length) {
    return [];
  }

  // 2. Fetch FX rates for conversion
  const uniqueCurrencies = new Set<string>();
  positions.forEach((p) => uniqueCurrencies.add(p.currency));
  uniqueCurrencies.add(targetCurrency);

  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date,
  }));

  const exchangeRates = await fetchExchangeRates(exchangeRequests);

  // 3. Convert each position's local total value to target currency
  const positionsInTarget = positions.map((position) => ({
    ...position,
    total_value_target: convertCurrency(
      position.total_value,
      position.currency,
      targetCurrency,
      exchangeRates,
      date,
    ),
  }));

  // 4. Group by category and sum target-currency values
  const assetAllocationInTarget: {
    [key: string]: {
      category_id: string;
      name: string;
      total_value_target: number;
    };
  } = {};

  positionsInTarget.forEach((position) => {
    const category_id = position.category_id;

    if (assetAllocationInTarget[category_id]) {
      assetAllocationInTarget[category_id].total_value_target +=
        position.total_value_target;
    } else {
      assetAllocationInTarget[category_id] = {
        category_id: category_id,
        name: (position as { category_name?: string }).category_name || "",
        total_value_target: position.total_value_target,
      };
    }
  });

  const assetAllocation = Object.values(assetAllocationInTarget)
    .map((allocation) => ({
      category_id: allocation.category_id,
      name: allocation.name,
      total_value: allocation.total_value_target,
    }))
    .sort((a, b) => b.total_value - a.total_value);

  return assetAllocation;
}
