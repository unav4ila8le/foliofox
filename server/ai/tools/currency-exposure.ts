"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
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
 * - Non-symbol holdings: latest record <= date
 * - Symbol holdings: market price at date (fallback to record unit_value)
 * - Bulk FX conversion to baseCurrency at date
 */
export async function getCurrencyExposure(
  params: GetCurrencyExposureParams = {},
): Promise<CurrencyExposureResult> {
  try {
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    const date = params.date ? new Date(params.date) : new Date();
    const dateKey = format(date, "yyyy-MM-dd");

    // Fetch all holdings with full record history; we will compute "as-of" ourselves
    const { holdings, records: recordsByHolding } = await fetchHoldings({
      includeArchived: true,
      includeRecords: true,
      // no quoteDate here; we fetch quotes separately for the as-of date
    });

    if (!holdings?.length) {
      return {
        baseCurrency,
        date: dateKey,
        totals: { valueBase: 0 },
        currencies: [],
      };
    }

    // Prepare bulk requests
    const symbolIds = holdings
      .filter((h) => h.symbol_id)
      .map((h) => h.symbol_id!) as string[];

    const quoteRequests =
      symbolIds.length > 0
        ? symbolIds.map((id) => ({ symbolId: id, date }))
        : [];

    const uniqueCurrencies = new Set<string>();
    holdings.forEach((h) => uniqueCurrencies.add(h.currency));
    uniqueCurrencies.add(baseCurrency);

    // Fetch quotes and FX in parallel
    const [quotesMap, exchangeRatesMap] = await Promise.all([
      quoteRequests.length > 0 ? fetchQuotes(quoteRequests) : new Map(),
      fetchExchangeRates(
        Array.from(uniqueCurrencies).map((currency) => ({ currency, date })),
      ),
    ]);

    // Aggregate by original holding currency using as-of record + quote
    const byCurrency = new Map<
      string,
      { valueLocal: number; holdingsCount: number }
    >();

    holdings.forEach((h) => {
      const holdingRecords = recordsByHolding.get(h.id) || [];
      // holdingRecords are globally ordered by date desc, created_at desc
      const latestAsOf = holdingRecords.find((r) => r.date <= dateKey);
      if (!latestAsOf) return;

      // Determine unit price as-of date
      let unitPrice = latestAsOf.unit_value || 0;
      if (h.symbol_id) {
        const qKey = `${h.symbol_id}|${dateKey}`;
        const mkt = quotesMap.get(qKey);
        if (mkt && mkt > 0) unitPrice = mkt;
      }

      const localValue = unitPrice * latestAsOf.quantity;

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
