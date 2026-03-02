"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";
import {
  parseUTCDateKey,
  resolveTodayDateKey,
  toCivilDateKey,
} from "@/lib/date/date-utils";

interface GetCurrencyExposureParams {
  baseCurrency: string | null;
  date: string | null; // YYYY-MM-DD (optional). Defaults to today.
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
  params: GetCurrencyExposureParams,
): Promise<CurrencyExposureResult> {
  try {
    // 1. Resolve profile once for default currency + civil "today".
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    // 2. Resolve one as-of key/date pair for positions + FX.
    const requestedDateKey = params.date ? toCivilDateKey(params.date) : null;
    const asOfDateKey =
      requestedDateKey ?? resolveTodayDateKey(profile.time_zone);
    const date = parseUTCDateKey(asOfDateKey);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date for currency exposure");
    }

    // 3. Fetch positions (assets) valued as-of the date.
    const positions = await fetchPositions({
      positionType: "asset",
      includeArchived: true,
      asOfDateKey,
    });

    if (!positions?.length) {
      return {
        baseCurrency,
        date: asOfDateKey,
        totals: { valueBase: 0 },
        currencies: [],
      };
    }

    // 4. Fetch FX rates for conversion.
    const uniqueCurrencies = new Set<string>();
    positions.forEach((p) => uniqueCurrencies.add(p.currency));
    uniqueCurrencies.add(baseCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date,
    }));

    const exchangeRates = await fetchExchangeRates(exchangeRequests);

    // 5. Aggregate by original position currency using as-of local totals.
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

    // 6. Map to result items with conversion and pct computation.
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
      date: asOfDateKey,
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
