"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchFinancialProfile } from "@/server/financial-profiles/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { resolveSymbolsBatch } from "@/server/symbols/resolve";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { convertCurrency } from "@/lib/currency-conversion";
import { parseUTCDateKey, startOfUTCDay } from "@/lib/date/date-utils";

/**
 * Get portfolio overview for AI analysis
 * Accurate as-of behavior when a date is provided:
 * - Positions valued via latest snapshot at/before date
 * - FX conversion as-of date
 */
export async function getPortfolioOverview(params: {
  baseCurrency: string | null;
  date: string | null;
  includeAfterTax: boolean | null;
}) {
  try {
    // Get user's profile to use their preferred currency
    const baseCurrency =
      params.baseCurrency ?? (await fetchProfile()).profile.display_currency;

    // Use a single date across quotes and FX for consistency
    const parsedDate = params.date ? parseUTCDateKey(params.date) : null;
    const asOfDate =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate
        : startOfUTCDay(new Date());

    // Fetch user's financial profile
    const financialProfile = await fetchFinancialProfile();
    const includeAfterTax = params.includeAfterTax === true;

    // Fetch positions valued as-of the target date
    const positions = await fetchPositions({
      includeArchived: true,
      asOfDate: asOfDate,
    });

    // If no positions, return empty state
    if (!positions?.length)
      return {
        summary: "No positions found in portfolio",
        netWorth: 0,
        netWorthGross: 0,
        netWorthAfterCapitalGains: includeAfterTax ? 0 : null,
        estimatedCapitalGainsTax: includeAfterTax ? 0 : null,
        includeAfterTax,
        currency: baseCurrency,
        positionsCount: 0,
        categories: [],
        positions: [],
        lastUpdated: new Date().toISOString(),
      };

    // Resolve tickers for any symbols once to reuse below
    const symbolIdSet = new Set(
      positions
        .map((position) => position.symbol_id)
        .filter((id): id is string => Boolean(id)),
    );

    const symbolIdToTicker = new Map<string, string>();
    if (symbolIdSet.size) {
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

    // Fetch FX rates for the as-of date
    const uniqueCurrencies = new Set<string>();
    positions.forEach((position) => uniqueCurrencies.add(position.currency));
    uniqueCurrencies.add(baseCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: asOfDate,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // Compute per-position as-of values
    const positionsBase = positions
      .map((position) => {
        const unitLocal = position.current_unit_value || 0;
        const quantity = position.current_quantity || 0;
        const totalLocal = position.total_value || unitLocal * quantity;

        const unitValueBase = convertCurrency(
          unitLocal,
          position.currency,
          baseCurrency,
          exchangeRates,
          asOfDate,
        );
        const totalValueBase = convertCurrency(
          totalLocal,
          position.currency,
          baseCurrency,
          exchangeRates,
          asOfDate,
        );

        return {
          id: position.id,
          name: position.name,
          symbol: position.symbol_id
            ? (symbolIdToTicker.get(position.symbol_id) ?? null)
            : null,
          category: position.category_name!,
          categoryId: position.category_id,
          capital_gains_tax_rate: position.capital_gains_tax_rate ?? null,
          quantity,
          unitValue: unitValueBase,
          value: totalValueBase,
          currency: baseCurrency,
          isArchived: position.is_archived,
          original: {
            currency: position.currency,
            unitValue: unitLocal,
            value: totalLocal,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.value as number) - (a!.value as number)) as Array<{
      id: string;
      name: string;
      symbol: string | null;
      category: string;
      categoryId: string;
      capital_gains_tax_rate: number | null;
      quantity: number;
      unitValue: number;
      value: number;
      currency: string;
      isArchived: boolean;
      original: { currency: string; unitValue: number; value: number };
    }>;

    // Compute net worth from computed positions (avoid duplicate heavy calls)
    const netWorth = positionsBase.reduce((sum, h) => sum + h.value, 0);
    const netWorthGross = netWorth;

    let netWorthAfterCapitalGains: number | null = null;
    let estimatedCapitalGainsTax: number | null = null;
    if (includeAfterTax) {
      netWorthAfterCapitalGains = await calculateNetWorth(
        baseCurrency,
        asOfDate,
        undefined,
        "after_capital_gains",
      );
      estimatedCapitalGainsTax = Math.max(
        0,
        netWorthGross - netWorthAfterCapitalGains,
      );
    }

    // Compute allocation via centralized analysis util to mirror previous logic
    const allocation = await calculateAssetAllocation(baseCurrency, asOfDate);
    const categories = allocation
      .map((a) => ({
        name: a.name,
        id: a.category_id,
        value: a.total_value,
        percentage: netWorth ? (a.total_value / netWorth) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      summary: `Portfolio contains ${positionsBase.length} positions across ${categories.length} categories`,
      financialProfile,
      netWorth: netWorthGross,
      netWorthGross,
      netWorthAfterCapitalGains,
      estimatedCapitalGainsTax,
      includeAfterTax,
      currency: baseCurrency,
      positionsCount: positionsBase.length,
      categoriesCount: categories.length,
      categories,
      positions: positionsBase,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching portfolio overview:", error);
    throw new Error(
      `Failed to fetch portfolio overview: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
