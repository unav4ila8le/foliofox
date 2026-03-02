"use server";

import { cache } from "react";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";
import {
  type CivilDateKey,
  type UTCDateKey,
  formatUTCDateKey,
  parseUTCDateKey,
  parseLocalDateKey,
  resolveTodayDateKey,
} from "@/lib/date/date-utils";
import type { PositionsQueryContext } from "@/server/positions/fetch";
import { fetchProfile } from "@/server/profile/actions";

import {
  buildUTCMonthStart,
  buildProjectionBasisBySymbolId,
  calculateMonthlyDividend,
  formatUTCMonthKey,
} from "@/server/analysis/projected-income/utils";

import type {
  DividendEvent,
  ProjectedIncomeData,
  TransformedPosition,
} from "@/types/global.types";

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

interface MissingFxContext {
  symbolId: string;
  positionName: string;
}

interface MissingFxDetail extends MissingFxContext {
  sourceCurrency: string;
  targetCurrency: string;
}

interface ProjectedIncomeFxContext {
  fxDateKey: UTCDateKey;
  convertAmount: (
    amount: number,
    sourceCurrency: string,
    targetCurrency: string,
    context: MissingFxContext,
  ) => number | null;
  getMissingCount: () => number;
  getMissingDetails: () => MissingFxDetail[];
}

async function createProjectedIncomeFxContext(input: {
  positions: TransformedPosition[];
  dividendsMap: Map<string, { events: DividendEvent[] }>;
  targetCurrency: string;
  asOfDateKey: CivilDateKey;
}): Promise<ProjectedIncomeFxContext> {
  const { positions, dividendsMap, targetCurrency, asOfDateKey } = input;
  const fxDate = parseUTCDateKey(asOfDateKey);
  const fxDateKey = formatUTCDateKey(fxDate);

  // Build a minimal, deduplicated FX request set once per run.
  const uniqueCurrencies = new Set<string>([targetCurrency]);
  positions.forEach((position) => {
    uniqueCurrencies.add(position.currency);
  });
  dividendsMap.forEach(({ events }) => {
    events.forEach((event) => {
      uniqueCurrencies.add(event.currency);
    });
  });

  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date: fxDate,
  }));

  const exchangeRatesMap = await fetchExchangeRates(exchangeRequests);

  let missingFxConversions = 0;
  const missingFxDetails = new Map<string, MissingFxDetail>();

  const convertAmount = (
    amount: number,
    sourceCurrency: string,
    destinationCurrency: string,
    context: MissingFxContext,
  ) => {
    if (sourceCurrency === destinationCurrency) return amount;

    const toUsdKey = `${sourceCurrency}|${fxDateKey}`;
    const fromUsdKey = `${destinationCurrency}|${fxDateKey}`;

    if (!exchangeRatesMap.has(toUsdKey) || !exchangeRatesMap.has(fromUsdKey)) {
      missingFxConversions += 1;
      const detailKey = `${context.symbolId}|${sourceCurrency}|${destinationCurrency}`;
      if (!missingFxDetails.has(detailKey)) {
        missingFxDetails.set(detailKey, {
          symbolId: context.symbolId,
          positionName: context.positionName,
          sourceCurrency,
          targetCurrency: destinationCurrency,
        });
      }
      return null;
    }

    return convertCurrency(
      amount,
      sourceCurrency,
      destinationCurrency,
      exchangeRatesMap,
      fxDateKey,
    );
  };

  return {
    fxDateKey,
    convertAmount,
    getMissingCount: () => missingFxConversions,
    getMissingDetails: () => Array.from(missingFxDetails.values()),
  };
}

/**
 * Calculate projected monthly income for user's portfolio
 */
export const calculateProjectedIncome = cache(
  async (
    targetCurrency: string,
    monthsAhead: number = 12,
    context?: PositionsQueryContext,
    asOfDateKey?: CivilDateKey,
  ) => {
    try {
      // 1. Resolve analysis day in civil-date semantics.
      const resolvedAsOfDateKey =
        asOfDateKey ??
        resolveTodayDateKey((await fetchProfile()).profile.time_zone);
      const today = parseUTCDateKey(resolvedAsOfDateKey);

      // 2. Fetch portfolio and dividend basis inputs.
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

      // 3. Build reusable FX conversion context for the whole projection run.
      const fxContext = await createProjectedIncomeFxContext({
        positions,
        dividendsMap,
        targetCurrency,
        asOfDateKey: resolvedAsOfDateKey,
      });

      // 4. Calculate monthly projected income series.
      const monthlyIncome = new Map<string, number>();

      for (let i = 0; i < monthsAhead; i++) {
        const monthStart = buildUTCMonthStart(today, i);
        const monthKey = formatUTCMonthKey(monthStart);
        let monthTotal = 0;

        positions.forEach((position) => {
          if (!position.symbol_id) return;

          const basis = projectionBasisBySymbolId.get(position.symbol_id);
          if (!basis) return;

          // Calculate expected dividend for this month based on frequency.
          const monthlyDividend = calculateMonthlyDividend(monthStart, basis);
          const positionDividendIncome =
            monthlyDividend * position.current_quantity;

          const convertedValue = fxContext.convertAmount(
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

      const missingFxDetails = fxContext.getMissingDetails();
      if (missingFxDetails.length > 0) {
        // Keep a single, structured log for easier debugging later.
        console.warn("[projected-income] Missing FX rates", {
          fxDateKey: fxContext.fxDateKey,
          targetCurrency,
          missing: missingFxDetails,
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
          fxContext.getMissingCount() > 0
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
    asOfDateKey?: CivilDateKey,
  ): Promise<ProjectedIncomeStackedResult> => {
    try {
      // 1. Resolve analysis day in civil-date semantics.
      const resolvedAsOfDateKey =
        asOfDateKey ??
        resolveTodayDateKey((await fetchProfile()).profile.time_zone);
      const today = parseUTCDateKey(resolvedAsOfDateKey);

      // 2. Fetch portfolio and dividend basis inputs.
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

      // 3. Build reusable FX conversion context for the whole projection run.
      const fxContext = await createProjectedIncomeFxContext({
        positions,
        dividendsMap,
        targetCurrency,
        asOfDateKey: resolvedAsOfDateKey,
      });

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
        const monthStart = buildUTCMonthStart(today, i);
        const monthKey = formatUTCMonthKey(monthStart);
        const values: Record<string, number> = {};
        let monthTotal = 0;

        positionSeries.forEach((series) => {
          const basis = projectionBasisBySymbolId.get(series.symbolId);
          if (!basis) return;

          const monthlyDividend = calculateMonthlyDividend(monthStart, basis);
          const positionDividendIncome = monthlyDividend * series.quantity;

          const convertedValue = fxContext.convertAmount(
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

      const missingFxDetails = fxContext.getMissingDetails();
      if (missingFxDetails.length > 0) {
        console.warn("[projected-income] Missing FX rates", {
          fxDateKey: fxContext.fxDateKey,
          targetCurrency,
          missing: missingFxDetails,
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
          fxContext.getMissingCount() > 0
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
