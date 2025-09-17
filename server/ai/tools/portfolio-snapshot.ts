"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

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
    const asOfKey = format(asOfDate, "yyyy-MM-dd");

    // Fetch holdings with full history so we can compute true "as-of" values
    const { holdings, records: recordsByHolding } = await fetchHoldings({
      includeArchived: true,
      includeRecords: true,
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

    // Prepare bulk requests for quotes and FX at as-of date
    const symbolIds = holdings
      .filter((h) => h.symbol_id)
      .map((h) => h.symbol_id!) as string[];

    const quoteRequests =
      symbolIds.length > 0
        ? symbolIds.map((id) => ({ symbolId: id, date: asOfDate }))
        : [];

    const uniqueCurrencies = new Set<string>();
    holdings.forEach((h) => uniqueCurrencies.add(h.currency));
    uniqueCurrencies.add(baseCurrency);

    const [quotesMap, exchangeRatesMap] = await Promise.all([
      quoteRequests.length > 0 ? fetchQuotes(quoteRequests) : new Map(),
      fetchExchangeRates(
        Array.from(uniqueCurrencies).map((currency) => ({
          currency,
          date: asOfDate,
        })),
      ),
    ]);

    // Compute per-holding as-of values
    const holdingsBase = holdings
      .map((h) => {
        const recs = recordsByHolding.get(h.id) || [];
        const latestAsOf = recs.find((r) => r.date <= asOfKey);
        if (!latestAsOf) return null;

        // Unit price as-of: use market quote for symbols, else record value
        let unitLocal = latestAsOf.unit_value || 0;
        if (h.symbol_id) {
          const qKey = `${h.symbol_id}|${asOfKey}`;
          const mkt = quotesMap.get(qKey);
          if (mkt && mkt > 0) unitLocal = mkt;
        }

        const quantity = latestAsOf.quantity || 0;
        const totalLocal = unitLocal * quantity;

        // Convert to base currency at as-of date
        const unitValueBase = convertCurrency(
          unitLocal,
          h.currency,
          baseCurrency,
          exchangeRatesMap,
          asOfDate,
        );
        const totalValueBase = convertCurrency(
          totalLocal,
          h.currency,
          baseCurrency,
          exchangeRatesMap,
          asOfDate,
        );

        return {
          id: h.id,
          name: h.name,
          symbol: h.symbol_id || null,
          category: h.asset_type,
          categoryCode: h.category_code,
          quantity,
          unitValue: unitValueBase,
          value: totalValueBase,
          currency: baseCurrency,
          isArchived: h.is_archived,
          original: {
            currency: h.currency,
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

    // Compute asset allocation as-of (group by category using base currency values)
    const allocationByCategory = new Map<
      string,
      { code: string; name: string; total_value: number }
    >();

    holdingsBase.forEach((h) => {
      const acc = allocationByCategory.get(h.categoryCode) || {
        code: h.categoryCode,
        name: h.category,
        total_value: 0,
      };
      acc.total_value += h.value;
      allocationByCategory.set(h.categoryCode, acc);
    });

    const categories = Array.from(allocationByCategory.values())
      .map((c) => ({
        name: c.name,
        code: c.code,
        value: c.total_value,
        percentage: netWorth ? (c.total_value / netWorth) * 100 : 0,
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
