"use server";

import { cache } from "react";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { fetchProfile } from "@/server/profile/actions";

import { convertCurrency } from "@/lib/currency-conversion";
import {
  parseUTCDateKey,
  resolveTodayDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";
import type { PositionsQueryContext } from "@/server/positions/fetch";

/**
 * Calculate asset allocation by category at a specific date.
 * Uses bulk market data fetching for optimal performance.
 */
export const calculateAssetAllocation = cache(
  async (
    targetCurrency: string,
    asOfDateKey?: CivilDateKey,
    context?: PositionsQueryContext,
  ) => {
    // 1. Resolve the valuation day from caller input or profile timezone.
    const resolvedAsOfDateKey =
      asOfDateKey ??
      resolveTodayDateKey((await fetchProfile()).profile.time_zone);
    const asOfDate = parseUTCDateKey(resolvedAsOfDateKey);
    if (Number.isNaN(asOfDate.getTime())) {
      throw new Error("Invalid as-of date key for asset allocation");
    }

    // 2. Fetch positions valued as-of date (no snapshots histories needed)
    const positions = await fetchPositions(
      {
        positionType: "asset",
        includeArchived: true,
        asOfDateKey: resolvedAsOfDateKey,
      },
      context,
    );

    if (!positions?.length) {
      return [];
    }

    // 3. Fetch FX rates for conversion
    const uniqueCurrencies = new Set<string>();
    positions.forEach((p) => uniqueCurrencies.add(p.currency));
    uniqueCurrencies.add(targetCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: asOfDate,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // 4. Convert each position's local total value to target currency
    const positionsInTarget = positions.map((position) => ({
      ...position,
      total_value_target: convertCurrency(
        position.total_value,
        position.currency,
        targetCurrency,
        exchangeRates,
        asOfDate,
      ),
    }));

    // 5. Group by category and sum target-currency values
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
  },
);
