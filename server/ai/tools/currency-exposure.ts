"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

interface GetCurrencyExposureParams {
  baseCurrency?: string;
  date?: string; // YYYY-MM-DD (optional). Defaults to today.
}

interface CurrencyExposureItem {
  currency: string;
  valueLocal: number;
  valueBase: number;
  pct: number;
  fx: number; // 1 unit of currency -> baseCurrency
  holdingsCount: number;
}

interface CurrencyExposureResult {
  baseCurrency: string;
  date: string; // YYYY-MM-DD
  totals: {
    valueBase: number;
  };
  currencies: CurrencyExposureItem[];
}

/**
 * Currency exposure as-of a date:
 * - Uses holdings valued as-of (records/market-backed handled upstream)
 * - Converts local totals to baseCurrency using FX as-of date
 */
export async function getCurrencyExposure(
  params: GetCurrencyExposureParams = {},
): Promise<CurrencyExposureResult> {
  try {
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    const date = params.date ? new Date(params.date) : new Date();
    const dateKey = format(date, "yyyy-MM-dd");

    // Fetch holdings valued as-of the date
    const holdings = await fetchHoldings({
      includeArchived: true,
      asOfDate: date,
    });

    if (!holdings?.length) {
      return {
        baseCurrency,
        date: dateKey,
        totals: { valueBase: 0 },
        currencies: [],
      };
    }

    // Fetch only FX for conversion
    const { exchangeRates: exchangeRatesMap } = await fetchMarketData(
      holdings,
      date,
      baseCurrency,
      { include: { marketPrices: false } },
    );

    // Aggregate by original holding currency using as-of local totals
    const byCurrency = new Map<
      string,
      { valueLocal: number; holdingsCount: number }
    >();

    holdings.forEach((h) => {
      const localValue = h.total_value || 0;

      const acc = byCurrency.get(h.currency) || {
        valueLocal: 0,
        holdingsCount: 0,
      };
      acc.valueLocal += localValue;
      acc.holdingsCount += 1;
      byCurrency.set(h.currency, acc);
    });

    // Map to result items with conversion and pct computation
    const items: CurrencyExposureItem[] = Array.from(byCurrency.entries()).map(
      ([currency, data]) => {
        const valueBase = convertCurrency(
          data.valueLocal,
          currency,
          baseCurrency,
          exchangeRatesMap,
          date,
        );
        const fx = convertCurrency(
          1,
          currency,
          baseCurrency,
          exchangeRatesMap,
          date,
        );
        return {
          currency,
          valueLocal: data.valueLocal,
          valueBase,
          pct: 0, // set after total
          fx,
          holdingsCount: data.holdingsCount,
        };
      },
    );

    const totalBase = items.reduce((s, c) => s + c.valueBase, 0);
    const currencies = items
      .map((it) => ({
        ...it,
        pct: totalBase > 0 ? (it.valueBase / totalBase) * 100 : 0,
      }))
      .sort((a, b) => b.valueBase - a.valueBase);

    return {
      baseCurrency,
      date: dateKey,
      totals: { valueBase: totalBase },
      currencies,
    };
  } catch (error) {
    console.error("Error calculating currency exposure:", error);
    throw new Error(
      `Failed to calculate currency exposure: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
