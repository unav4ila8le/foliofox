import { formatUTCDateKey, type UTCDateKey } from "@/lib/date/date-utils";

export interface ChartQuoteEntry {
  dateKey: UTCDateKey;
  closePrice: number;
  adjustedClosePrice: number;
}

/**
 * Normalize provider chart quotes into UTC date-keyed close prices.
 *
 * Keeps both close and adjusted close values so callers can choose the
 * appropriate series (valuation parity vs adjusted analytics).
 * This function does not synthesize non-trading calendar days.
 */
export function normalizeChartQuoteEntries(
  chartData: {
    quotes?: Array<{
      date?: Date | null;
      adjclose?: number | null;
      close?: number | null;
    }>;
  } | null,
): ChartQuoteEntry[] {
  return (chartData?.quotes ?? [])
    .map((quote) => {
      if (!quote.date || !(quote.date instanceof Date)) return null;

      const closePrice = quote.close;
      if (!closePrice || closePrice <= 0) return null;

      // Some rows can miss adjusted close; keep a valid adjusted series anyway.
      const adjustedClosePrice =
        quote.adjclose && quote.adjclose > 0 ? quote.adjclose : closePrice;

      return {
        dateKey: formatUTCDateKey(quote.date),
        closePrice,
        adjustedClosePrice,
      };
    })
    .filter((entry): entry is ChartQuoteEntry => entry !== null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
