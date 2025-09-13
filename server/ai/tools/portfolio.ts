"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { calculateNetWorth } from "@/server/analysis/net-worth";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

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

    // Get current holdings (active only for main snapshot)
    const holdings = await fetchHoldings({
      includeArchived: false,
      quoteDate: new Date(),
    });

    // If no holdings, return empty state
    if (holdings.length === 0) {
      return {
        summary: "No holdings found in portfolio",
        netWorth: 0,
        currency: baseCurrency,
        holdingsCount: 0,
        categories: [],
        topHoldings: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Calculate key metrics in parallel
    const [netWorth, assetAllocation] = await Promise.all([
      calculateNetWorth(baseCurrency),
      calculateAssetAllocation(baseCurrency),
    ]);

    // Prepare holdings for AI (sorted by value)
    const holdingsData = holdings
      .sort((a, b) => b.total_value - a.total_value)
      .map((holding) => ({
        name: holding.name,
        symbol: holding.symbol_id || null,
        value: holding.total_value,
        category: holding.asset_type,
        quantity: holding.current_quantity,
        unitValue: holding.current_unit_value,
        currency: holding.currency,
      }));

    // Format asset allocation for AI
    const categories = assetAllocation.map((category) => ({
      name: category.name,
      code: category.category_code,
      value: category.total_value,
      percentage: ((category.total_value / netWorth) * 100).toFixed(1),
    }));

    return {
      summary: `Portfolio contains ${holdings.length} holdings across ${assetAllocation.length} categories`,
      netWorth,
      currency: baseCurrency,
      holdingsCount: holdings.length,
      categoriesCount: assetAllocation.length,
      categories,
      holdings: holdingsData,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching portfolio snapshot:", error);
    throw new Error(
      `Failed to fetch portfolio snapshot: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
