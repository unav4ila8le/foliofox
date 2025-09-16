"use server";

import { format } from "date-fns";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

interface GetAllocationDriftParams {
  baseCurrency?: string;
  compareToDate: string; // YYYY-MM-DD
}

interface CategoryDrift {
  code: string;
  name: string;
  previousValue: number;
  currentValue: number;
  previousPct: number;
  currentPct: number;
  deltaPct: number; // currentPct - previousPct (percentage points)
}

/**
 * Compare asset allocation now vs a past date and report % drift by category.
 */
export async function getAllocationDrift(params: GetAllocationDriftParams) {
  try {
    const { profile } = await fetchProfile();
    const baseCurrency = params.baseCurrency ?? profile.display_currency;

    const compareDate = new Date(params.compareToDate);
    const currentDate = new Date();
    const compareKey = format(compareDate, "yyyy-MM-dd");
    const currentKey = format(currentDate, "yyyy-MM-dd");

    // Fetch holdings with full record history; skip quote injection (we fetch our own)
    const { holdings, records: recordsByHolding } = await fetchHoldings({
      includeArchived: true,
      includeRecords: true,
    });

    if (!holdings?.length) {
      return {
        baseCurrency,
        compareToDate: compareKey,
        currentDate: currentKey,
        totals: { previous: 0, current: 0 },
        categories: [] as CategoryDrift[],
        topDrifts: {
          positive: [] as CategoryDrift[],
          negative: [] as CategoryDrift[],
        },
      };
    }

    // Build bulk requests (quotes + FX) for both dates
    const symbolIds = holdings
      .filter((h) => h.symbol_id)
      .map((h) => h.symbol_id!) as string[];

    const quoteRequests =
      symbolIds.length > 0
        ? [
            ...symbolIds.map((id) => ({ symbolId: id, date: compareDate })),
            ...symbolIds.map((id) => ({ symbolId: id, date: currentDate })),
          ]
        : [];

    const uniqueCurrencies = new Set<string>();
    holdings.forEach((h) => uniqueCurrencies.add(h.currency));
    uniqueCurrencies.add(baseCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).flatMap(
      (currency) => [
        { currency, date: compareDate },
        { currency, date: currentDate },
      ],
    );

    const [quotesMap, exchangeRatesMap] = await Promise.all([
      quoteRequests.length > 0
        ? fetchQuotes(quoteRequests)
        : new Map<string, number>(),
      exchangeRequests.length > 0
        ? fetchExchangeRates(exchangeRequests)
        : new Map<string, number>(),
    ]);

    // Helper: get holding value in base currency at a date
    const valueInBaseAtDate = (
      holdingId: string,
      holdingCurrency: string,
      date: Date,
      dateKey: string,
      symbolId: string | null,
    ): number => {
      const records = recordsByHolding.get(holdingId) || [];
      if (records.length === 0) return 0;

      // Sort records once (desc by date, then created_at)
      const sorted = [...records].sort((a, b) => {
        const d = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (d !== 0) return d;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      const latestAsOf = sorted.find((r) => r.date <= dateKey);
      if (!latestAsOf) return 0;

      let unitValue = latestAsOf.unit_value || 0;
      if (symbolId) {
        const qKey = `${symbolId}|${dateKey}`;
        const mkt = quotesMap.get(qKey);
        if (mkt && mkt > 0) unitValue = mkt;
      }

      const rawValue = unitValue * latestAsOf.quantity;
      return convertCurrency(
        rawValue,
        holdingCurrency,
        baseCurrency,
        exchangeRatesMap,
        date,
      );
    };

    // Aggregate values by category for previous and current dates
    const prevByCategory = new Map<
      string,
      { code: string; name: string; value: number }
    >();
    const currByCategory = new Map<
      string,
      { code: string; name: string; value: number }
    >();

    holdings.forEach((h) => {
      const prevVal = valueInBaseAtDate(
        h.id,
        h.currency,
        compareDate,
        compareKey,
        h.symbol_id || null,
      );
      const currVal = valueInBaseAtDate(
        h.id,
        h.currency,
        currentDate,
        currentKey,
        h.symbol_id || null,
      );

      const code = h.category_code;
      const name = h.asset_type;

      const prevAcc = prevByCategory.get(code) || { code, name, value: 0 };
      prevAcc.value += prevVal;
      prevByCategory.set(code, prevAcc);

      const currAcc = currByCategory.get(code) || { code, name, value: 0 };
      currAcc.value += currVal;
      currByCategory.set(code, currAcc);
    });

    const previousTotal = Array.from(prevByCategory.values()).reduce(
      (s, c) => s + c.value,
      0,
    );
    const currentTotal = Array.from(currByCategory.values()).reduce(
      (s, c) => s + c.value,
      0,
    );

    // Build category drift list (union of categories present in either map)
    const allCodes = new Set<string>([
      ...Array.from(prevByCategory.keys()),
      ...Array.from(currByCategory.keys()),
    ]);

    const categories: CategoryDrift[] = Array.from(allCodes).map((code) => {
      const prev = prevByCategory.get(code) || { code, name: "", value: 0 };
      const curr = currByCategory.get(code) || {
        code,
        name: prev.name,
        value: 0,
      };

      const previousPct =
        previousTotal > 0 ? (prev.value / previousTotal) * 100 : 0;
      const currentPct =
        currentTotal > 0 ? (curr.value / currentTotal) * 100 : 0;
      const deltaPct = currentPct - previousPct;

      return {
        code,
        name: curr.name || prev.name,
        previousValue: prev.value,
        currentValue: curr.value,
        previousPct,
        currentPct,
        deltaPct,
      };
    });

    // Sort categories by absolute drift (largest change first)
    categories.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

    const positive = categories.filter((c) => c.deltaPct > 0).slice(0, 5);
    const negative = categories.filter((c) => c.deltaPct < 0).slice(0, 5);

    return {
      baseCurrency,
      compareToDate: compareKey,
      currentDate: currentKey,
      totals: { previous: previousTotal, current: currentTotal },
      categories,
      topDrifts: { positive, negative },
    };
  } catch (error) {
    console.error("Error calculating allocation drift:", error);
    throw new Error(
      `Failed to calculate allocation drift: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
