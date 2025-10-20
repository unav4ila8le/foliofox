"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";
import { convertCurrency } from "@/lib/currency-conversion";

/**
 * Get portfolio snapshot for AI analysis (positions model)
 * Accurate as-of behavior when a date is provided:
 * - Positions valued via latest snapshot at/before date
 * - FX conversion as-of date
 */
export async function getPortfolioSnapshot(params?: {
  baseCurrency?: string;
  date?: string;
}) {
  try {
    // Get user's profile to use their preferred currency
    const { profile } = await fetchProfile();
    const baseCurrency = params?.baseCurrency ?? profile.display_currency;

    // Use a single date across quotes and FX for consistency
    const asOfDate = params?.date ? new Date(params.date) : new Date();

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
        currency: baseCurrency,
        positionsCount: 0,
        categories: [],
        positions: [],
        lastUpdated: new Date().toISOString(),
      };

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
          symbol: position.symbol_id || null,
          category: position.category_name!,
          categoryId: position.category_id,
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
      quantity: number;
      unitValue: number;
      value: number;
      currency: string;
      isArchived: boolean;
      original: { currency: string; unitValue: number; value: number };
    }>;

    // Compute net worth from computed positions (avoid duplicate heavy calls)
    const netWorth = positionsBase.reduce((sum, h) => sum + h.value, 0);

    // Compute allocation via centralized analysis util to mirror previous logic
    const allocation = await calculateAssetAllocation(baseCurrency, asOfDate);
    const categories = allocation
      .map((a) => ({
        name: a.name,
        id: a.categoryId,
        value: a.total_value,
        percentage: netWorth ? (a.total_value / netWorth) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      summary: `Portfolio contains ${positionsBase.length} positions across ${categories.length} categories`,
      netWorth,
      currency: baseCurrency,
      positionsCount: positionsBase.length,
      categoriesCount: categories.length,
      categories,
      positions: positionsBase,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching portfolio snapshot:", error);
    throw new Error(
      `Failed to fetch portfolio snapshot: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
