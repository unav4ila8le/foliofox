import { formatUTCDateKey } from "@/lib/date/date-utils";

/**
 * Chunk an array into smaller arrays of a given size.
 * @param arr - The array to chunk
 * @param size - The size of the chunks
 * @returns The chunked array
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) {
    return arr.length ? [arr.slice()] : [];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }

  return chunks;
}

export interface ChartQuoteEntry {
  dateKey: string;
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
