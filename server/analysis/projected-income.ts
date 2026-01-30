"use server";

import { cache } from "react";
import { addMonths, startOfMonth } from "date-fns";

import { fetchPositions } from "@/server/positions/fetch";
import { fetchDividends } from "@/server/dividends/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { resolveSymbolInput } from "@/server/symbols/resolve";

import { convertCurrency } from "@/lib/currency-conversion";
import {
  formatLocalDateKey,
  parseLocalDateKey,
  parseUtcDateKey,
} from "@/lib/date/date-utils";
import type { PositionsQueryContext } from "@/server/positions/fetch";

import type {
  Dividend,
  DividendEvent,
  ProjectedIncomeData,
} from "@/types/global.types";

export interface ProjectedIncomeResult {
  success: boolean;
  data?: ProjectedIncomeData[];
  message?: string;
  currency?: string;
}

interface DividendProjectionBasis {
  annualAmount: number;
  frequency: Dividend["inferred_frequency"] | null;
  lastPaymentMonth: number | null;
  currency: string;
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

      const projectionBasisBySymbolId = new Map<
        string,
        DividendProjectionBasis
      >();

      positions.forEach((position) => {
        if (!position.symbol_id) return;
        if (projectionBasisBySymbolId.has(position.symbol_id)) return;

        const dividendData = dividendsMap.get(position.symbol_id);
        if (!dividendData?.summary) return;
        if (
          dividendData.summary.pays_dividends === false &&
          dividendData.events.length === 0
        ) {
          return;
        }

        const basis = buildDividendProjectionBasis(
          dividendData.summary,
          dividendData.events,
          {
            currentUnitValue: position.current_unit_value,
            fallbackCurrency: position.currency,
          },
        );

        if (basis) {
          projectionBasisBySymbolId.set(position.symbol_id, basis);
        }
      });

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

/**
 * Calculate monthly dividend amount based on frequency
 */
function calculateMonthlyDividend(
  month: Date,
  basis: DividendProjectionBasis,
): number {
  if (!basis.annualAmount || basis.annualAmount <= 0) {
    return 0;
  }

  const frequency = basis.frequency;
  const lastPaymentMonth = basis.lastPaymentMonth;
  const currentMonth = month.getMonth();

  switch (frequency) {
    case "monthly":
      return basis.annualAmount / 12;
    case "quarterly":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Check if this month aligns with quarterly pattern
      const monthsSinceLastPayment =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPayment % 3 === 0 ? basis.annualAmount / 4 : 0;
    case "semiannual":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Check if this month aligns with semiannual pattern (every 6 months)
      const monthsSinceLastPaymentSemi =
        (currentMonth - lastPaymentMonth + 12) % 12;
      return monthsSinceLastPaymentSemi % 6 === 0 ? basis.annualAmount / 2 : 0;
    case "annual":
      if (lastPaymentMonth === null) {
        return basis.annualAmount / 12;
      }
      // Return full annual amount only in the payment month
      return currentMonth === lastPaymentMonth ? basis.annualAmount : 0;
    case "irregular":
      return basis.annualAmount / 12;
    default:
      return basis.annualAmount / 12;
  }
}

function buildDividendProjectionBasis(
  summary: Dividend,
  events: DividendEvent[],
  options: {
    currentUnitValue?: number;
    fallbackCurrency: string;
  },
): DividendProjectionBasis | null {
  const annualAmount = resolveAnnualDividendAmount(
    summary,
    events,
    options.currentUnitValue,
  );

  if (!annualAmount || annualAmount <= 0) {
    return null;
  }

  const latestEvent = getLatestDividendEvent(events);
  const lastPaymentMonth = resolveLastPaymentMonth(summary, latestEvent);

  return {
    annualAmount,
    frequency: summary.inferred_frequency ?? "irregular",
    lastPaymentMonth,
    currency: latestEvent?.currency ?? options.fallbackCurrency,
  };
}

function resolveAnnualDividendAmount(
  summary: Dividend,
  events: DividendEvent[],
  currentUnitValue?: number,
): number {
  // Prefer provider amounts unless they are clearly inflated compared to payouts we observed.
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentEvents = events.filter(
    (event) => new Date(event.event_date) >= oneYearAgo,
  );

  const eventAnnualAmount =
    recentEvents.length > 0
      ? recentEvents.reduce((sum, event) => sum + event.gross_amount, 0)
      : 0;

  const providerTtm = summary.trailing_ttm_dividend || 0;
  const providerForward = summary.forward_annual_dividend || 0;

  const hasEvents = eventAnnualAmount > 0;
  const ttmWithinTolerance =
    providerTtm > 0 && hasEvents
      ? providerTtm >= eventAnnualAmount * 0.9 &&
        providerTtm <= eventAnnualAmount * 1.1
      : true;

  // Keep TTM when it aligns with payouts (±10%); otherwise prefer events, then forward.
  let annualAmount =
    providerTtm > 0 && ttmWithinTolerance
      ? providerTtm
      : hasEvents
        ? eventAnnualAmount
        : providerForward > 0
          ? providerForward
          : providerTtm;

  if (annualAmount <= 0) {
    // Yahoo dividend_yield is an annual rate (decimal, e.g. 0.04 = 4%).
    const yieldRate = summary.dividend_yield ?? 0;
    if (yieldRate > 0 && currentUnitValue && currentUnitValue > 0) {
      annualAmount = yieldRate * currentUnitValue;
    }
  }

  return annualAmount > 0 ? annualAmount : 0;
}

function resolveLastPaymentMonth(
  summary: Dividend,
  latestEvent: DividendEvent | null,
): number | null {
  const lastDividendDate =
    summary.last_dividend_date ?? latestEvent?.event_date ?? null;

  if (!lastDividendDate) return null;

  const parsed = parseUtcDateKey(lastDividendDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.getUTCMonth();
}

function getLatestDividendEvent(events: DividendEvent[]): DividendEvent | null {
  if (events.length === 0) return null;

  return events.reduce(
    (latest, current) => {
      if (!latest) return current;
      return new Date(current.event_date) > new Date(latest.event_date)
        ? current
        : latest;
    },
    null as DividendEvent | null,
  );
}
