"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

/**
 * Get current portfolio snapshot for AI analysis
 * Returns summarized data optimized for AI consumption
 */
export async function getPortfolioSnapshot(params?: { baseCurrency?: string }) {
  try {
    // Ensure user is authenticated (required for RLS)
    await getCurrentUser();

    // Get user's profile to use their preferred currency
    const { profile } = await fetchProfile();
    const baseCurrency = params?.baseCurrency ?? profile.display_currency;

    // Use a signle date across quotes and FX for consistency
    const date = new Date();
    const dateKey = format(date, "yyyy-MM-dd");

    // Get current holdings (active only for main snapshot)
    const holdings = await fetchHoldings({
      includeArchived: false,
      quoteDate: date,
    });

    // If no holdings, return empty state
    if (holdings.length === 0) {
      return {
        summary: "No holdings found in portfolio",
        netWorth: 0,
        currency: baseCurrency,
        holdingsCount: 0,
        categories: [],
        holdings: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Calculate key metrics in parallel
    const [netWorth, assetAllocation] = await Promise.all([
      calculateNetWorth(baseCurrency, date),
      calculateAssetAllocation(baseCurrency),
    ]);

    // Collect unique holding currencies
    const uniqueCurrencies = new Set<string>();
    holdings.forEach((holding) => {
      uniqueCurrencies.add(holding.currency);
    });
    uniqueCurrencies.add(baseCurrency);

    // Bulk FX fetch
    const exchangeRatesMap = await fetchExchangeRates(
      Array.from(uniqueCurrencies).map((currency) => ({
        currency,
        date,
      })),
    );

    const convertToBaseCurrency = (
      amount: number,
      sourceCurrency: string,
    ): number => {
      if (sourceCurrency === baseCurrency) return amount;
      const toUSD = exchangeRatesMap.get(`${sourceCurrency}|${dateKey}`);
      const fromUSD = exchangeRatesMap.get(`${baseCurrency}|${dateKey}`);
      if (!toUSD || !fromUSD) {
        return amount;
      }
      return (amount / toUSD) * fromUSD;
    };

    // Prepare holdings for AI (sorted by base currency value)
    const holdingsBase = holdings
      .map((h) => {
        const unitValueBase = convertToBaseCurrency(
          h.current_unit_value,
          h.currency,
        );
        const totalValueBase = convertToBaseCurrency(h.total_value, h.currency);
        return {
          id: h.id,
          name: h.name,
          symbol: h.symbol_id || null,
          category: h.asset_type,
          categoryCode: h.category_code,
          quantity: h.current_quantity,
          unitValue: unitValueBase,
          value: totalValueBase,
          currency: baseCurrency,
          original: {
            currency: h.currency,
            unitValue: h.current_unit_value,
            value: h.total_value,
          },
        };
      })
      .sort((a, b) => b.value - a.value);

    // Format asset allocation for AI
    const categories = assetAllocation.map((category) => ({
      name: category.name,
      code: category.category_code,
      value: category.total_value,
      percentage: netWorth ? (category.total_value / netWorth) * 100 : 0,
    }));

    return {
      summary: `Portfolio contains ${holdings.length} holdings across ${assetAllocation.length} categories`,
      netWorth,
      currency: baseCurrency,
      holdingsCount: holdings.length,
      categoriesCount: assetAllocation.length,
      categories,
      holdings: holdingsBase,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching portfolio snapshot:", error);
    throw new Error(
      `Failed to fetch portfolio snapshot: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
