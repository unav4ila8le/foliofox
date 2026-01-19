import { formatUtcDateKey } from "@/lib/date-format";

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
  price: number;
}

/**
 * Normalize chart quote entries without applying trading-session guards.
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

      const value = quote.adjclose ?? quote.close;
      if (!value || value <= 0) return null;

      return {
        dateKey: formatUtcDateKey(quote.date),
        price: value,
      };
    })
    .filter((entry): entry is ChartQuoteEntry => entry !== null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
