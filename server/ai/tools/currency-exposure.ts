"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

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
  assetsCount: number;
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
 * - Uses positions (assets) valued as-of (market-backed handled upstream)
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

    // Fetch positions (assets) valued as-of the date
    const positions = await fetchPositions({
      positionType: "asset",
      includeArchived: true,
      asOfDate: date,
    });

    if (!positions?.length) {
      return {
        baseCurrency,
        date: dateKey,
        totals: { valueBase: 0 },
        currencies: [],
      };
    }

    // Fetch FX rates for conversion
    const uniqueCurrencies = new Set<string>();
    positions.forEach((p) => uniqueCurrencies.add(p.currency));
    uniqueCurrencies.add(baseCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // Aggregate by original position currency using as-of local totals
    const byCurrency = new Map<
      string,
      { valueLocal: number; assetsCount: number }
    >();

    positions.forEach((p) => {
      const localValue = p.total_value || 0;

      const acc = byCurrency.get(p.currency) || {
        valueLocal: 0,
        assetsCount: 0,
      };
      acc.valueLocal += localValue;
      acc.assetsCount += 1;
      byCurrency.set(p.currency, acc);
    });

    // Map to result items with conversion and pct computation
    const items: CurrencyExposureItem[] = Array.from(byCurrency.entries()).map(
      ([currency, data]) => {
        const valueBase = convertCurrency(
          data.valueLocal,
          currency,
          baseCurrency,
          exchangeRates,
          date,
        );
        const fx = convertCurrency(
          1,
          currency,
          baseCurrency,
          exchangeRates,
          date,
        );
        return {
          currency,
          valueLocal: data.valueLocal,
          valueBase,
          pct: 0, // set after total
          fx,
          assetsCount: data.assetsCount,
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
