"use server";

import { cache } from "react";
import { addMonths, startOfMonth } from "date-fns";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { resolveSymbolInput } from "@/server/symbols/resolve";

import { convertCurrency } from "@/lib/currency-conversion";
import { formatLocalDateKey, parseLocalDateKey } from "@/lib/date/date-utils";
import type { PositionsQueryContext } from "@/server/positions/fetch";

import {
  buildDividendProjectionBasis,
  buildProjectionBasisBySymbolId,
  calculateMonthlyDividend,
} from "@/server/analysis/projected-income/utils";

import type { DividendEvent, ProjectedIncomeData } from "@/types/global.types";

export interface ProjectedIncomeResult {
  success: boolean;
  data?: ProjectedIncomeData[];
  message?: string;
  currency?: string;
}

export interface ProjectedIncomeStackedSeries {
  key: string;
  positionId: string;
  symbolId: string;
  name: string;
}

export interface ProjectedIncomeStackedMonth {
  date: Date;
  total: number;
  values: Record<string, number>;
}

export interface ProjectedIncomeStackedResult {
  success: boolean;
  data?: ProjectedIncomeStackedMonth[];
  series?: ProjectedIncomeStackedSeries[];
  message?: string;
  currency?: string;
}

/**
 * Calculate projected monthly income for user's portfolio
 */
export const calculateProjectedIncome = cache(
  async (
    targetCurrency: string,
    monthsAhead: number = 12,
    context?: PositionsQueryContext,
  ) => {
    try {
      const positions = await fetchPositions(
        {
          positionType: "asset",
          includeArchived: false,
        },
        context,
      );

      const symbolIds = positions
        .filter((position) => position.symbol_id)
        .map((position) => position.symbol_id!);

      if (symbolIds.length === 0) {
        return {
          success: true,
          data: [],
          message: "No positions with market data found",
        };
      }

      const dividendsMap = await fetchDividends(
        symbolIds.map((symbolId) => ({ symbolId })),
      );

      const projectionBasisBySymbolId = buildProjectionBasisBySymbolId(
        positions,
        dividendsMap,
      );

      if (projectionBasisBySymbolId.size === 0) {
        return {
          success: true,
          data: [],
          message: "No dividend-paying positions found in your portfolio",
        };
      }

      // Collect unique currencies we need exchange rates for
      const uniqueCurrencies = new Set<string>();
      positions.forEach((position) => {
        uniqueCurrencies.add(position.currency);
      });
      // Add dividend event currencies (from dividend_events table)
      dividendsMap.forEach(({ events }) => {
        events.forEach((event: DividendEvent) => {
          uniqueCurrencies.add(event.currency);
        });
      });
      uniqueCurrencies.add(targetCurrency);

      // Create exchange rate requests for unique currencies only
      const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
        currency,
        date: new Date(),
      }));

      // Fetch exchange rates
      const exchangeRatesMap = await fetchExchangeRates(exchangeRequests);

      // Calculate monthly projected income
      const monthlyIncome = new Map<string, number>();
      const today = new Date();
      const fxDateKey = formatLocalDateKey(today);
      let missingFxConversions = 0;
      const missingFxDetails = new Map<
        string,
        {
          symbolId: string;
          positionName: string;
          sourceCurrency: string;
          targetCurrency: string;
        }
      >();

      const tryConvertCurrency = (
        amount: number,
        sourceCurrency: string,
        targetCurrency: string,
        context: { symbolId: string; positionName: string },
      ) => {
        if (sourceCurrency === targetCurrency) return amount;

        const toUsdKey = `${sourceCurrency}|${fxDateKey}`;
        const fromUsdKey = `${targetCurrency}|${fxDateKey}`;

        if (
          !exchangeRatesMap.has(toUsdKey) ||
          !exchangeRatesMap.has(fromUsdKey)
        ) {
          missingFxConversions += 1;
          const detailKey = `${context.symbolId}|${sourceCurrency}|${targetCurrency}`;
          if (!missingFxDetails.has(detailKey)) {
            missingFxDetails.set(detailKey, {
              symbolId: context.symbolId,
              positionName: context.positionName,
              sourceCurrency,
              targetCurrency,
            });
          }
          return null;
        }

        return convertCurrency(
          amount,
          sourceCurrency,
          targetCurrency,
          exchangeRatesMap,
          fxDateKey,
        );
      };

      for (let i = 0; i < monthsAhead; i++) {
        const monthStart = startOfMonth(addMonths(today, i));
        const monthKey = formatLocalDateKey(monthStart).slice(0, 7);
        let monthTotal = 0;

        positions.forEach((position) => {
          if (!position.symbol_id) return;

          const basis = projectionBasisBySymbolId.get(position.symbol_id);
          if (!basis) return;

          // Calculate expected dividend for this month based on frequency.
          const monthlyDividend = calculateMonthlyDividend(monthStart, basis);
          const positionDividendIncome =
            monthlyDividend * position.current_quantity;

          const convertedValue = tryConvertCurrency(
            positionDividendIncome,
            basis.currency,
            targetCurrency,
            {
              symbolId: position.symbol_id,
              positionName: position.name,
            },
          );

          if (convertedValue !== null) {
            monthTotal += convertedValue;
          }
        });

        monthlyIncome.set(monthKey, monthTotal);
      }

      if (missingFxDetails.size > 0) {
        // Keep a single, structured log for easier debugging later.
        console.warn("[projected-income] Missing FX rates", {
          fxDateKey,
          targetCurrency,
          missing: Array.from(missingFxDetails.values()),
        });
      }

      return {
        success: true,
        data: Array.from(monthlyIncome.entries()).map(([month, income]) => ({
          // Use local date keys to avoid timezone shifts in the chart UI.
          date: parseLocalDateKey(`${month}-01`),
          income,
        })),
        currency: targetCurrency,
        message:
          missingFxConversions > 0
            ? "Some payouts were omitted due to missing FX rates."
            : undefined,
      };
    } catch (error) {
      console.error("Error calculating projected income:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to calculate projected income",
      };
    }
  },
);

/**
 * Calculate projected income by asset for stacked bar charts.
 */
export const calculateProjectedIncomeByAsset = cache(
  async (
    targetCurrency: string,
    monthsAhead: number = 12,
    context?: PositionsQueryContext,
  ): Promise<ProjectedIncomeStackedResult> => {
    try {
      const positions = await fetchPositions(
        {
          positionType: "asset",
          includeArchived: false,
        },
        context,
      );

      const symbolIds = positions
        .filter((position) => position.symbol_id)
        .map((position) => position.symbol_id!);

      if (symbolIds.length === 0) {
        return {
          success: true,
          data: [],
          series: [],
          message: "No positions with market data found",
        };
      }

      const dividendsMap = await fetchDividends(
        symbolIds.map((symbolId) => ({ symbolId })),
      );

      const projectionBasisBySymbolId = buildProjectionBasisBySymbolId(
        positions,
        dividendsMap,
      );

      if (projectionBasisBySymbolId.size === 0) {
        return {
          success: true,
          data: [],
          series: [],
          message: "No dividend-paying positions found in your portfolio",
        };
      }

      const uniqueCurrencies = new Set<string>();
      positions.forEach((position) => {
        uniqueCurrencies.add(position.currency);
      });
      dividendsMap.forEach(({ events }) => {
        events.forEach((event: DividendEvent) => {
          uniqueCurrencies.add(event.currency);
        });
      });
      uniqueCurrencies.add(targetCurrency);

      const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
        currency,
        date: new Date(),
      }));

      const exchangeRatesMap = await fetchExchangeRates(exchangeRequests);

      const today = new Date();
      const fxDateKey = formatLocalDateKey(today);
      let missingFxConversions = 0;
      const missingFxDetails = new Map<
        string,
        {
          symbolId: string;
          positionName: string;
          sourceCurrency: string;
          targetCurrency: string;
        }
      >();

      const tryConvertCurrency = (
        amount: number,
        sourceCurrency: string,
        targetCurrency: string,
        context: { symbolId: string; positionName: string },
      ) => {
        if (sourceCurrency === targetCurrency) return amount;

        const toUsdKey = `${sourceCurrency}|${fxDateKey}`;
        const fromUsdKey = `${targetCurrency}|${fxDateKey}`;

        if (
          !exchangeRatesMap.has(toUsdKey) ||
          !exchangeRatesMap.has(fromUsdKey)
        ) {
          missingFxConversions += 1;
          const detailKey = `${context.symbolId}|${sourceCurrency}|${targetCurrency}`;
          if (!missingFxDetails.has(detailKey)) {
            missingFxDetails.set(detailKey, {
              symbolId: context.symbolId,
              positionName: context.positionName,
              sourceCurrency,
              targetCurrency,
            });
          }
          return null;
        }

        return convertCurrency(
          amount,
          sourceCurrency,
          targetCurrency,
          exchangeRatesMap,
          fxDateKey,
        );
      };

      const positionSeries = positions
        .filter((position) => position.symbol_id)
        .map((position) => ({
          key: position.id,
          positionId: position.id,
          symbolId: position.symbol_id!,
          name: position.name,
          quantity: position.current_quantity,
        }));

      const hasSeriesValue = new Map<string, boolean>();
      const monthlyRows: ProjectedIncomeStackedMonth[] = [];

      for (let i = 0; i < monthsAhead; i++) {
        const monthStart = startOfMonth(addMonths(today, i));
        const monthKey = formatLocalDateKey(monthStart).slice(0, 7);
        const values: Record<string, number> = {};
        let monthTotal = 0;

        positionSeries.forEach((series) => {
          const basis = projectionBasisBySymbolId.get(series.symbolId);
          if (!basis) return;

          const monthlyDividend = calculateMonthlyDividend(monthStart, basis);
          const positionDividendIncome = monthlyDividend * series.quantity;

          const convertedValue = tryConvertCurrency(
            positionDividendIncome,
            basis.currency,
            targetCurrency,
            {
              symbolId: series.symbolId,
              positionName: series.name,
            },
          );

          if (convertedValue === null) return;

          values[series.key] = convertedValue;
          monthTotal += convertedValue;

          if (convertedValue > 0) {
            hasSeriesValue.set(series.key, true);
          }
        });

        monthlyRows.push({
          // Use local date keys to avoid timezone shifts in the chart UI.
          date: parseLocalDateKey(`${monthKey}-01`),
          total: monthTotal,
          values,
        });
      }

      if (missingFxDetails.size > 0) {
        console.warn("[projected-income] Missing FX rates", {
          fxDateKey,
          targetCurrency,
          missing: Array.from(missingFxDetails.values()),
        });
      }

      const series: ProjectedIncomeStackedSeries[] = positionSeries
        .filter((item) => hasSeriesValue.get(item.key))
        .map((item) => ({
          key: item.key,
          positionId: item.positionId,
          symbolId: item.symbolId,
          name: item.name,
        }));

      return {
        success: true,
        data: monthlyRows,
        series,
        currency: targetCurrency,
        message:
          missingFxConversions > 0
            ? "Some payouts were omitted due to missing FX rates."
            : undefined,
      };
    } catch (error) {
      console.error("Error calculating projected income by asset:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to calculate projected income",
      };
    }
  },
);

/**
 * Calculate projected income for a specific symbol
 */
export async function calculateSymbolProjectedIncome(
  symbolLookup: string,
  quantity: number,
  monthsAhead: number = 12,
  unitValue?: number,
) {
  try {
    const resolved = await resolveSymbolInput(symbolLookup);
    if (!resolved?.symbol?.id) {
      return {
        success: false,
        data: [],
        message: `Unable to resolve symbol lookup "${symbolLookup}".`,
      };
    }

    const canonicalId = resolved.symbol.id;

    const dividendsMap = await fetchDividends([{ symbolId: canonicalId }]);
    const dividendData = dividendsMap.get(canonicalId);

    if (!dividendData?.summary) {
      return {
        success: true,
        data: [],
        message: "No dividend information available for this symbol",
      };
    }

    if (
      dividendData.summary.pays_dividends === false &&
      dividendData.events.length === 0
    ) {
      return {
        success: true,
        data: [],
        message: "This symbol does not pay dividends",
      };
    }

    const projectionBasis = buildDividendProjectionBasis(
      dividendData.summary,
      dividendData.events,
      {
        currentUnitValue: unitValue,
        fallbackCurrency: "USD",
      },
    );

    if (!projectionBasis) {
      return {
        success: true,
        data: [],
        message: "No dividend data available for this symbol",
      };
    }

    // Calculate monthly projected income in the dividend's own currency
    const monthlyIncome = new Map<string, number>();
    const today = new Date();

    for (let i = 0; i < monthsAhead; i++) {
      const monthStart = startOfMonth(addMonths(today, i));
      const monthKey = formatLocalDateKey(monthStart).slice(0, 7);

      const monthlyDividend = calculateMonthlyDividend(
        monthStart,
        projectionBasis,
      );
      const symbolDividendIncome = monthlyDividend * quantity;

      // Keep the income in the dividend's own currency (no conversion)
      monthlyIncome.set(monthKey, symbolDividendIncome);
    }

    return {
      success: true,
      data: Array.from(monthlyIncome.entries()).map(([month, income]) => ({
        // Use local date keys to avoid timezone shifts in the chart UI.
        date: parseLocalDateKey(`${month}-01`),
        income,
      })),
      currency: projectionBasis.currency,
    };
  } catch (error) {
    console.error(
      "Error calculating projected income for %s:",
      symbolLookup,
      error,
    );
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to calculate projected income",
    };
  }
}
