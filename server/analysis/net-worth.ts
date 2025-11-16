"use server";

import { cache } from "react";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";
import type { PositionsQueryContext } from "@/server/positions/fetch";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export const calculateNetWorth = cache(
  async (
    targetCurrency: string,
    date: Date = new Date(),
    context?: PositionsQueryContext,
  ) => {
    // 1. Fetch positions valued as-of the date
    const positions = await fetchPositions(
      {
        includeArchived: true,
        asOfDate: date,
      },
      context,
    );

    if (!positions?.length) return 0;

    // 2. Fetch FX rates for conversion
    const uniqueCurrencies = new Set<string>();
    positions.forEach((p) => uniqueCurrencies.add(p.currency));
    uniqueCurrencies.add(targetCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // 3. Sum converted values
    let netWorth = 0;
    positions.forEach((position) => {
      const localValue = position.total_value;
      const convertedValue = convertCurrency(
        localValue,
        position.currency,
        targetCurrency,
        exchangeRates,
        date,
      );
      netWorth += convertedValue;
    });

    return netWorth;
  },
);
