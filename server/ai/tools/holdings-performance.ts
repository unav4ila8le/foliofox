"use server";

import { format, subDays } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";

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

    // Set date range (default to 180 days)
    const endDate = params.endDate ? new Date(params.endDate) : new Date();
    const startDate = params.startDate
      ? new Date(params.startDate)
      : subDays(endDate, 180);

    const startDateKey = format(startDate, "yyyy-MM-dd");
    const endDateKey = format(endDate, "yyyy-MM-dd");

    // Get holdings to analyze
    const allHoldings = await fetchHoldings({
      includeArchived: true,
      includeRecords: true,
      quoteDate: endDate,
    });

    const { holdings, records: recordsByHolding } = allHoldings;

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

    // Fetch market data for both dates using centralized aggregator
    const [startData, endData] = await Promise.all([
      fetchMarketData(targetHoldings, startDate, baseCurrency),
      fetchMarketData(targetHoldings, endDate, baseCurrency),
    ]);

    // Merge maps for quick lookup
    const quotesMap = new Map<string, number>([
      ...(startData.quotes ?? new Map()),
      ...(endData.quotes ?? new Map()),
    ]);
    const exchangeRatesMap = new Map<string, number>([
      ...(startData.exchangeRates ?? new Map()),
      ...(endData.exchangeRates ?? new Map()),
    ]);

    // Calculate unrealized P/L for current positions
    const holdingsWithPL = calculateProfitLoss(
      targetHoldings,
      recordsByHolding,
    );

    // Analyze each holding
    const performanceData: HoldingPerformanceData[] = [];

    for (const holding of targetHoldings) {
      const holdingRecords = recordsByHolding.get(holding.id) || [];

      // Get quantities at start and end dates
      const startRecord = holdingRecords
        .filter((r) => r.date <= startDateKey)
        .sort((a, b) => {
          const dateDiff =
            new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        })[0];

      const endRecord = holdingRecords
        .filter((r) => r.date <= endDateKey)
        .sort((a, b) => {
          const dateDiff =
            new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        })[0];

      // Check if we have partial period coverage
      const partialPeriod =
        !startRecord || new Date(startRecord.date) > startDate;

      const startQuantity = startRecord?.quantity || 0;
      const endQuantity = endRecord?.quantity || 0;

      // Get unit prices (market quotes or record values)
      let startPrice: number;
      let endPrice: number;

      if (holding.symbol_id) {
        const startQuoteKey = `${holding.symbol_id}|${startDateKey}`;
        const endQuoteKey = `${holding.symbol_id}|${endDateKey}`;

        startPrice =
          quotesMap.get(startQuoteKey) || startRecord?.unit_value || 0;
        endPrice = quotesMap.get(endQuoteKey) || endRecord?.unit_value || 0;
      } else {
        startPrice = startRecord?.unit_value || 0;
        endPrice = endRecord?.unit_value || 0;
      }

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
      const startValueBase = startQuantity * startPriceBase;
      const endValueBase = endQuantity * endPriceBase;

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
