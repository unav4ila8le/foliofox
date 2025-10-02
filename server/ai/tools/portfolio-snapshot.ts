"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { calculateAssetAllocation } from "@/server/analysis/asset-allocation";

import { convertCurrency } from "@/lib/currency-conversion";

/**
 * Get portfolio snapshot for AI analysis
 * Accurate as-of behavior when a date is provided:
 * - Non-symbol holdings: latest record where record.date <= date
 * - Symbol holdings: market price as-of date (fallback to record unit_value)
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

    // Fetch holdings valued as-of the target date
    const holdings = await fetchHoldings({
      includeArchived: true,
      asOfDate: asOfDate,
    });

    // If no holdings, return empty state
    if (!holdings?.length)
      return {
        summary: "No holdings found in portfolio",
        netWorth: 0,
        currency: baseCurrency,
        holdingsCount: 0,
        categories: [],
        holdings: [],
        lastUpdated: new Date().toISOString(),
      };

    // Fetch FX rates for the as-of date
    const uniqueCurrencies = new Set<string>();
    holdings.forEach((h) => uniqueCurrencies.add(h.currency));
    uniqueCurrencies.add(baseCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: asOfDate,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // Compute per-holding as-of values
    const holdingsBase = holdings
      .map((holding) => {
        const unitLocal = holding.current_unit_value || 0;
        const quantity = holding.current_quantity || 0;
        const totalLocal = holding.total_value || unitLocal * quantity;

        const unitValueBase = convertCurrency(
          unitLocal,
          holding.currency,
          baseCurrency,
          exchangeRates,
          asOfDate,
        );
        const totalValueBase = convertCurrency(
          totalLocal,
          holding.currency,
          baseCurrency,
          exchangeRates,
          asOfDate,
        );

        return {
          id: holding.id,
          name: holding.name,
          symbol: holding.symbol_id || null,
          category: holding.asset_type,
          categoryCode: holding.category_code,
          quantity,
          unitValue: unitValueBase,
          value: totalValueBase,
          currency: baseCurrency,
          isArchived: holding.is_archived,
          original: {
            currency: holding.currency,
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
      categoryCode: string;
      quantity: number;
      unitValue: number;
      value: number;
      currency: string;
      isArchived: boolean;
      original: { currency: string; unitValue: number; value: number };
    }>;

    // Compute net worth from computed holdings (avoid duplicate heavy calls)
    const netWorth = holdingsBase.reduce((sum, h) => sum + h.value, 0);

    // Compute asset allocation via centralized analysis util
    const allocation = await calculateAssetAllocation(baseCurrency, asOfDate);
    const categories = allocation
      .map((a) => ({
        name: a.name,
        code: a.category_code,
        value: a.total_value,
        percentage: netWorth ? (a.total_value / netWorth) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      summary: `Portfolio contains ${holdingsBase.length} holdings across ${categories.length} categories`,
      netWorth,
      currency: baseCurrency,
      holdingsCount: holdingsBase.length,
      categoriesCount: categories.length,
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
