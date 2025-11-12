"use server";

import { parseISO } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { resolveSymbolsBatch } from "@/server/symbols/resolver";

import { calculateProfitLoss } from "@/lib/profit-loss";
import { convertCurrency } from "@/lib/currency-conversion";
import { clampDateRange } from "@/server/ai/tools/helpers/time-range";

interface GetAssetsPerformanceParams {
  baseCurrency: string | null;
  positionIds: string[] | null;
  startDate: string | null;
  endDate: string | null;
}

interface AssetPerformanceData {
  asset: {
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
 * Analyze asset(s) performance over a period
 * Returns price return, value change, and unrealized P/L data
 */
export async function getAssetsPerformance(params: GetAssetsPerformanceParams) {
  try {
    // Get user's profile for default currency
    const baseCurrency =
      params.baseCurrency ?? (await fetchProfile()).profile.display_currency;

    const { startDate: startDateKey, endDate: endDateKey } = clampDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    const startDate = parseISO(startDateKey);
    const endDate = parseISO(endDateKey);

    // Fetch end-date positions (with snapshots for P/L) and start-date positions (no snapshots needed)
    const [endSnapshot, startPositions] = await Promise.all([
      fetchPositions({
        positionType: "asset",
        includeArchived: true,
        includeSnapshots: true,
        asOfDate: endDate,
      }),
      fetchPositions({
        positionType: "asset",
        includeArchived: true,
        asOfDate: startDate,
      }),
    ]);

    const { positions: endPositions, snapshots: snapshotsByPosition } =
      endSnapshot;

    // Resolve tickers for any positions with symbols once - reuse for both start and end snapshots
    const symbolIdSet = new Set(
      endPositions
        .concat(startPositions)
        .map((p) => p.symbol_id)
        .filter((id): id is string => Boolean(id)),
    );

    const symbolIdToTicker = new Map<string, string>();
    if (symbolIdSet.size > 0) {
      const { byInput } = await resolveSymbolsBatch(Array.from(symbolIdSet), {
        provider: "yahoo",
        providerType: "ticker",
        onError: "warn",
      });

      byInput.forEach((resolution, symbolId) => {
        const ticker =
          resolution.displayTicker ?? resolution.providerAlias ?? null;
        if (ticker) {
          symbolIdToTicker.set(symbolId, ticker);
        }
      });
    }

    // Filter assets if specific position IDs provided
    const targetPositions = params.positionIds
      ? endPositions.filter((p) => params.positionIds!.includes(p.id))
      : endPositions;

    if (targetPositions.length === 0) {
      return {
        summary: "No assets found to analyze",
        period: { startDate: startDateKey, endDate: endDateKey, baseCurrency },
        assets: [],
        aggregated: null,
      };
    }

    // Fetch FX rates for start and end dates in parallel
    // Build requests for start date
    const startCurrencies = new Set<string>();
    startPositions.forEach((p) => startCurrencies.add(p.currency));
    startCurrencies.add(baseCurrency);

    const startExchangeRequests = Array.from(startCurrencies).map(
      (currency) => ({
        currency,
        date: startDate,
      }),
    );

    // Build requests for end date
    const endCurrencies = new Set<string>();
    endPositions.forEach((p) => endCurrencies.add(p.currency));
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

    // Build quick lookup for start snapshot by position id
    const startById = new Map(startPositions.map((p) => [p.id, p]));

    // Calculate unrealized P/L for current assets
    const positionsWithPL = calculateProfitLoss(
      targetPositions,
      snapshotsByPosition,
    );

    // Analyze each asset
    const performanceData: AssetPerformanceData[] = [];

    for (const position of targetPositions) {
      // Get start/end snapshots
      const startSnap = startById.get(position.id);
      const endSnap = position; // from end snapshot

      // Partial period if no start snapshot or start date is after requested start
      const partialPeriod = !startSnap;

      const startQuantity = startSnap?.current_quantity || 0;
      const endQuantity = endSnap?.current_quantity || 0;

      const startPrice = startSnap?.current_unit_value || 0;
      const endPrice = endSnap?.current_unit_value || 0;

      // Convert prices to base currency
      const startPriceBase = convertCurrency(
        startPrice,
        position.currency,
        baseCurrency,
        exchangeRatesMap,
        startDate,
      );
      const endPriceBase = convertCurrency(
        endPrice,
        position.currency,
        baseCurrency,
        exchangeRatesMap,
        endDate,
      );

      // Calculate values
      const startValueBase = convertCurrency(
        startSnap?.total_value || startQuantity * startPrice,
        position.currency,
        baseCurrency,
        exchangeRatesMap,
        startDate,
      );
      const endValueBase = convertCurrency(
        endSnap?.total_value || endQuantity * endPrice,
        position.currency,
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
      const positionWithPL = positionsWithPL.find((p) => p.id === position.id);
      const unrealized = {
        totalCostBasis: convertCurrency(
          positionWithPL?.total_cost_basis || 0,
          position.currency,
          baseCurrency,
          exchangeRatesMap,
          endDate,
        ),
        profitLoss: convertCurrency(
          positionWithPL?.profit_loss || 0,
          position.currency,
          baseCurrency,
          exchangeRatesMap,
          endDate,
        ),
        profitLossPct: positionWithPL?.profit_loss_percentage || 0,
      };

      performanceData.push({
        asset: {
          id: position.id,
          name: position.name,
          symbol: position.symbol_id
            ? (symbolIdToTicker.get(position.symbol_id) ?? null)
            : null,
          category: position.category_name ?? position.category_id,
          currency: position.currency,
          isArchived: position.is_archived,
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

    // Calculate aggregated metrics for multiple assets
    const aggregated =
      performanceData.length > 1
        ? (() => {
            const totalStartValue = performanceData.reduce(
              (sum, a) => sum + a.value.startBase,
              0,
            );
            const totalEndValue = performanceData.reduce(
              (sum, a) => sum + a.value.endBase,
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
              bestByPct: performanceData.reduce((best, a) =>
                a.performance.valueChangePct > best.performance.valueChangePct
                  ? a
                  : best,
              ),
              bestByAbs: performanceData.reduce((best, a) =>
                a.performance.valueChangeAbs > best.performance.valueChangeAbs
                  ? a
                  : best,
              ),

              worstByPct: performanceData.reduce((worst, a) =>
                a.performance.valueChangePct < worst.performance.valueChangePct
                  ? a
                  : worst,
              ),
              worstByAbs: performanceData.reduce((worst, a) =>
                a.performance.valueChangeAbs < worst.performance.valueChangeAbs
                  ? a
                  : worst,
              ),
            };
          })()
        : null;

    return {
      summary:
        performanceData.length === 1
          ? `Performance analysis for ${performanceData[0].asset.name}`
          : `Performance analysis for ${performanceData.length} assets`,
      period: {
        startDate: startDateKey,
        endDate: endDateKey,
        baseCurrency,
        daysCount: Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      },
      assets: performanceData.sort(
        (a, b) => b.performance.valueChangePct - a.performance.valueChangePct,
      ),
      aggregated,
    };
  } catch (error) {
    console.error("Error analyzing assets performance:", error);
    throw new Error(
      `Failed to analyze assets performance: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
