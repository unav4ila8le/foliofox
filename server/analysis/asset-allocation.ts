"use server";

import { format } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

import type { Record } from "@/types/global.types";

/**
 * Calculate asset allocation by category at a specific date.
 * Uses bulk market data fetching for optimal performance.
 */
export async function calculateAssetAllocation(
  targetCurrency: string,
  date: Date = new Date(),
) {
  // 1. Fetch holdings data
  const { holdings, records: recordsByHolding } = await fetchHoldings({
    includeArchived: true,
    includeRecords: true,
  });

  if (!holdings?.length) {
    return [];
  }

  // 2. Fetch market data for the specified date
  const {
    quotes: quotesMap,
    domainValuations: domainValuationsMap,
    exchangeRates: exchangeRatesMap,
  } = await fetchMarketData(holdings, date, targetCurrency);

  // 3. Process historical records for the specific date
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
      latestRecords.set(holding.id, recordsForDate[0]); // First one is latest due to sorting
    }
  });

  // 4. Calculate values using market data and convert to target currency
  const holdingsInTarget = holdings
    .map((holding) => {
      const record = latestRecords.get(holding.id);
      if (!record) return null;

      let unitValue = record.unit_value;

      // Use market data if available
      if (holding.symbol_id) {
        const quoteKey = `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
        const marketPrice = quotesMap.get(quoteKey);
        if (marketPrice) {
          unitValue = marketPrice;
        }
      }

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

      return {
        ...holding,
        total_value_target: convertedValue,
      };
    })
    .filter(
      (holding): holding is NonNullable<typeof holding> => holding !== null,
    );

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
