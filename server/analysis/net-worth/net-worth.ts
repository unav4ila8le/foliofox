"use server";

import { cache } from "react";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";
import { startOfUTCDay } from "@/lib/date/date-utils";
import { calculateProfitLoss } from "@/lib/profit-loss";
import { calculateCapitalGainsTaxAmount } from "@/server/analysis/net-worth/capital-gains-tax";
import type { PositionsQueryContext } from "@/server/positions/fetch";
import type { NetWorthMode } from "@/server/analysis/net-worth/types";
import type {
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export const calculateNetWorth = cache(
  async (
    targetCurrency: string,
    date?: Date,
    context?: PositionsQueryContext,
    mode: NetWorthMode = "gross",
  ) => {
    const asOfDate = date ?? startOfUTCDay(new Date());

    // 1. Fetch positions valued as-of the date.
    // In after-tax mode we need snapshots to compute unrealized gain from basis.
    // Gross mode only needs the transformed positions list.
    let positions: TransformedPosition[];
    let snapshotsByPosition: Map<string, PositionSnapshot[]> | null = null;

    if (mode === "after_capital_gains") {
      const positionsResult = await fetchPositions(
        {
          includeArchived: true,
          includeSnapshots: true,
          asOfDate,
        },
        context,
      );
      positions = positionsResult.positions;
      snapshotsByPosition = positionsResult.snapshots;
    } else {
      positions = await fetchPositions(
        {
          includeArchived: true,
          asOfDate,
        },
        context,
      );
    }

    if (!positions?.length) return 0;

    // 2. Fetch FX rates for conversion
    const uniqueCurrencies = new Set<string>();
    positions.forEach((p) => uniqueCurrencies.add(p.currency));
    uniqueCurrencies.add(targetCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: asOfDate,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // 3. Sum converted values (gross or net-of-capital-gains).
    if (mode === "gross") {
      let netWorth = 0;
      positions.forEach((position) => {
        const localValue = position.total_value;
        const convertedValue = convertCurrency(
          localValue,
          position.currency,
          targetCurrency,
          exchangeRates,
          asOfDate,
        );
        netWorth += convertedValue;
      });

      return netWorth;
    }

    // Reuse profit/loss helper so basis selection matches the rest of the app.
    const positionsWithProfitLoss = calculateProfitLoss(
      positions,
      snapshotsByPosition ?? new Map(),
    );

    let netWorth = 0;
    let taxTotal = 0;

    positionsWithProfitLoss.forEach((position) => {
      const localValue = position.total_value;
      const convertedValue = convertCurrency(
        localValue,
        position.currency,
        targetCurrency,
        exchangeRates,
        asOfDate,
      );
      netWorth += convertedValue;

      const localTax = calculateCapitalGainsTaxAmount({
        positionType: position.type,
        capitalGainsTaxRate: position.capital_gains_tax_rate,
        unrealizedGain: position.profit_loss,
      });
      if (localTax <= 0) return;

      // Convert tax in position currency to target currency before aggregation.
      taxTotal += convertCurrency(
        localTax,
        position.currency,
        targetCurrency,
        exchangeRates,
        asOfDate,
      );
    });

    return netWorth - taxTotal;
  },
);
