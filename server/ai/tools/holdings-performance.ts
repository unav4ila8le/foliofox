"use server";

import { format, subDays } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { calculateProfitLoss } from "@/lib/profit-loss";
import { convertCurrency } from "@/lib/currency-conversion";

interface GetHoldingsPerformanceParams {
  baseCurrency?: string;
  holdingIds?: string[];
  startDate?: string;
  endDate?: string;
}

interface HoldingPerformanceData {
  holding: {
    id: string;
    name: string;
    symbol: string | null;
    category: string;
    currency: string;
    isArchived: boolean;
  };
  period: {
    startDate: string;
    endDate: string;
    baseCurrency: string;
    partialPeriod: boolean;
  };
  price: {
    start: number;
    end: number;
    startBase: number;
    endBase: number;
  };
  quantity: {
    start: number;
    end: number;
  };
  value: {
    startBase: number;
    endBase: number;
  };
  performance: {
    priceReturnPct: number;
    valueChangeAbs: number;
    valueChangePct: number;
  };
  unrealized: {
    totalCostBasis: number;
    profitLoss: number;
    profitLossPct: number;
  };
}

/**
 * Analyze holding(s) performance over a period
 * Returns price return, value change, and unrealized P/L data
 */
export async function getHoldingsPerformance(
  params: GetHoldingsPerformanceParams = {},
) {
  try {
    // Get user's profile for default currency
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    // Set date range (default to 90 days)
    const endDate = params.endDate ? new Date(params.endDate) : new Date();
    const startDate = params.startDate
      ? new Date(params.startDate)
      : subDays(endDate, 90);

    const startDateKey = format(startDate, "yyyy-MM-dd");
    const endDateKey = format(endDate, "yyyy-MM-dd");

    // Fetch end-date holdings (with records for P/L) and start-date holdings (no records needed)
    const [endSnapshot, startHoldings] = await Promise.all([
      fetchHoldings({
        includeArchived: true,
        includeRecords: true,
        asOfDate: endDate,
      }),
      fetchHoldings({ includeArchived: true, asOfDate: startDate }),
    ]);

    const { holdings, records: recordsByHolding } = endSnapshot;

    // Filter holdings if specific IDs provided
    const targetHoldings = params.holdingIds
      ? holdings.filter((h) => params.holdingIds!.includes(h.id))
      : holdings;

    if (targetHoldings.length === 0) {
      return {
        summary: "No holdings found to analyze",
        period: { startDate: startDateKey, endDate: endDateKey, baseCurrency },
        holdings: [],
        aggregated: null,
      };
    }

    // Fetch FX rates for start and end dates in parallel
    // Build requests for start date
    const startCurrencies = new Set<string>();
    startHoldings.forEach((h) => startCurrencies.add(h.currency));
    startCurrencies.add(baseCurrency);

    const startExchangeRequests = Array.from(startCurrencies).map(
      (currency) => ({
        currency,
        date: startDate,
      }),
    );

    // Build requests for end date
    const endCurrencies = new Set<string>();
    holdings.forEach((h) => endCurrencies.add(h.currency));
    endCurrencies.add(baseCurrency);

    const endExchangeRequests = Array.from(endCurrencies).map((currency) => ({
      currency,
      date: endDate,
    }));

    // Fetch both in parallel
    const [startFx, endFx] = await Promise.all([
      fetchExchangeRates(startExchangeRequests),
      fetchExchangeRates(endExchangeRequests),
    ]);

    // Merge the maps
    const exchangeRatesMap = new Map<string, number>([...startFx, ...endFx]);

    // Build quick lookup for start snapshot by holding id
    const startById = new Map(startHoldings.map((h) => [h.id, h]));

    // Calculate unrealized P/L for current positions
    const holdingsWithPL = calculateProfitLoss(
      targetHoldings,
      recordsByHolding,
    );

    // Analyze each holding
    const performanceData: HoldingPerformanceData[] = [];

    for (const holding of targetHoldings) {
      // Get start/end snapshots
      const startSnap = startById.get(holding.id);
      const endSnap = holding; // from end snapshot

      // Partial period if no start snapshot or start date is after requested start
      const partialPeriod = !startSnap;

      const startQuantity = startSnap?.current_quantity || 0;
      const endQuantity = endSnap?.current_quantity || 0;

      const startPrice = startSnap?.current_unit_value || 0;
      const endPrice = endSnap?.current_unit_value || 0;

      // Convert prices to base currency
      const startPriceBase = convertCurrency(
        startPrice,
        holding.currency,
        baseCurrency,
        exchangeRatesMap,
        startDate,
      );
      const endPriceBase = convertCurrency(
        endPrice,
        holding.currency,
        baseCurrency,
        exchangeRatesMap,
        endDate,
      );

      // Calculate values
      const startValueBase = convertCurrency(
        startSnap?.total_value || startQuantity * startPrice,
        holding.currency,
        baseCurrency,
        exchangeRatesMap,
        startDate,
      );
      const endValueBase = convertCurrency(
        endSnap?.total_value || endQuantity * endPrice,
        holding.currency,
        baseCurrency,
        exchangeRatesMap,
        endDate,
      );

      // Performance calculations
      const priceReturnPct =
        startPriceBase > 0
          ? ((endPriceBase - startPriceBase) / startPriceBase) * 100
          : 0;

      const valueChangeAbs = endValueBase - startValueBase;
      const valueChangePct =
        startValueBase > 0 ? (valueChangeAbs / startValueBase) * 100 : 0;

      // Get unrealized P/L data
      const holdingWithPL = holdingsWithPL.find((h) => h.id === holding.id);
      const unrealized = {
        totalCostBasis: convertCurrency(
          holdingWithPL?.total_cost_basis || 0,
          holding.currency,
          baseCurrency,
          exchangeRatesMap,
          endDate,
        ),
        profitLoss: convertCurrency(
          holdingWithPL?.profit_loss || 0,
          holding.currency,
          baseCurrency,
          exchangeRatesMap,
          endDate,
        ),
        profitLossPct: holdingWithPL?.profit_loss_percentage || 0,
      };

      performanceData.push({
        holding: {
          id: holding.id,
          name: holding.name,
          symbol: holding.symbol_id,
          category: holding.asset_type,
          currency: holding.currency,
          isArchived: holding.is_archived,
        },
        period: {
          startDate: startDateKey,
          endDate: endDateKey,
          baseCurrency,
          partialPeriod,
        },
        price: {
          start: startPrice,
          end: endPrice,
          startBase: startPriceBase,
          endBase: endPriceBase,
        },
        quantity: {
          start: startQuantity,
          end: endQuantity,
        },
        value: {
          startBase: startValueBase,
          endBase: endValueBase,
        },
        performance: {
          priceReturnPct,
          valueChangeAbs: valueChangeAbs,
          valueChangePct,
        },
        unrealized,
      });
    }

    // Calculate aggregated metrics for multiple holdings
    const aggregated =
      performanceData.length > 1
        ? (() => {
            const totalStartValue = performanceData.reduce(
              (sum, h) => sum + h.value.startBase,
              0,
            );
            const totalEndValue = performanceData.reduce(
              (sum, h) => sum + h.value.endBase,
              0,
            );
            const totalValueChange = totalEndValue - totalStartValue;

            return {
              totalValueChange,
              totalStartValue,
              totalEndValue,
              totalReturnPct:
                totalStartValue > 0
                  ? (totalValueChange / totalStartValue) * 100
                  : 0,
              // Winners and losers by both metrics
              bestByPct: performanceData.reduce((best, h) =>
                h.performance.valueChangePct > best.performance.valueChangePct
                  ? h
                  : best,
              ),
              bestByAbs: performanceData.reduce((best, h) =>
                h.performance.valueChangeAbs > best.performance.valueChangeAbs
                  ? h
                  : best,
              ),

              worstByPct: performanceData.reduce((worst, h) =>
                h.performance.valueChangePct < worst.performance.valueChangePct
                  ? h
                  : worst,
              ),
              worstByAbs: performanceData.reduce((worst, h) =>
                h.performance.valueChangeAbs < worst.performance.valueChangeAbs
                  ? h
                  : worst,
              ),
            };
          })()
        : null;

    return {
      summary:
        performanceData.length === 1
          ? `Performance analysis for ${performanceData[0].holding.name}`
          : `Performance analysis for ${performanceData.length} holdings`,
      period: {
        startDate: startDateKey,
        endDate: endDateKey,
        baseCurrency,
        daysCount: Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      },
      holdings: performanceData.sort(
        (a, b) => b.performance.valueChangePct - a.performance.valueChangePct,
      ),
      aggregated,
    };
  } catch (error) {
    console.error("Error analyzing holdings performance:", error);
    throw new Error(
      `Failed to analyze holdings performance: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
