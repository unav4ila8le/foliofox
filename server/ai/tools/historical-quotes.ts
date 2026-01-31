"use server";

import {
  addUTCDays,
  formatUTCDateKey,
  parseUTCDateKey,
  startOfUTCDay,
} from "@/lib/date/date-utils";
import { fetchQuotes } from "@/server/quotes/fetch";
import { ensureSymbol } from "@/server/symbols/ensure";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;

type GetHistoricalQuotesParams = {
  symbolLookup: string;
  startDate: string | null;
  endDate: string | null;
};

export async function getHistoricalQuotes({
  symbolLookup,
  startDate,
  endDate,
}: GetHistoricalQuotesParams) {
  const normalizedLookup = symbolLookup.trim();
  if (!normalizedLookup) {
    throw new Error("symbol lookup is required");
  }

  const ensuredSymbol = await ensureSymbol(normalizedLookup);
  if (!ensuredSymbol?.symbol?.id) {
    throw new Error(`Symbol "${symbolLookup}" not found.`);
  }

  const canonicalId = ensuredSymbol.symbol.id;
  const displayTicker =
    ensuredSymbol.primaryAlias?.value ??
    ensuredSymbol.symbol?.ticker ??
    normalizedLookup;

  const resolvedEnd = endDate
    ? parseUTCDateKey(endDate)
    : startOfUTCDay(new Date());
  if (Number.isNaN(resolvedEnd.getTime())) {
    throw new Error("endDate is invalid");
  }

  const resolvedStart = startDate
    ? parseUTCDateKey(startDate)
    : addUTCDays(resolvedEnd, -DEFAULT_WINDOW_DAYS);
  if (Number.isNaN(resolvedStart.getTime())) {
    throw new Error("startDate is invalid");
  }

  if (resolvedStart > resolvedEnd) {
    throw new Error("startDate must be before or equal to endDate");
  }

  const totalDays =
    Math.floor((resolvedEnd.getTime() - resolvedStart.getTime()) / 86400000) +
    1;
  if (totalDays > MAX_WINDOW_DAYS) {
    throw new Error(
      `Date range is too large. Maximum supported window is ${MAX_WINDOW_DAYS} days.`,
    );
  }

  const requests = [];
  for (
    let cursor = resolvedStart;
    cursor <= resolvedEnd;
    cursor = addUTCDays(cursor, 1)
  ) {
    requests.push({ symbolLookup: canonicalId, date: cursor });
  }

  // Avoid caching ad-hoc AI lookups into the primary quotes table
  const quotesMap = await fetchQuotes(requests, false);

  const series = requests.map(({ date }) => {
    const dateString = formatUTCDateKey(date);
    const price =
      quotesMap.get(`${canonicalId}|${dateString}`) ??
      quotesMap.get(`${symbolLookup}|${dateString}`) ??
      null;

    return {
      date: dateString,
      price,
      source: "yahoo-finance",
      status: price !== null ? "ok" : "missing",
    };
  });

  return {
    symbolId: canonicalId,
    symbolTicker: displayTicker,
    startDate: formatUTCDateKey(resolvedStart),
    endDate: formatUTCDateKey(resolvedEnd),
    points: series,
    metadata: {
      totalDays,
      retrievedAt: new Date().toISOString(),
    },
  };
}
