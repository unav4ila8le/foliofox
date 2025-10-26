"use server";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { fetchQuotes } from "@/server/quotes/fetch";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;

type GetHistoricalQuotesParams = {
  symbolId: string;
  startDate: string | null;
  endDate: string | null;
};

export async function getHistoricalQuotes({
  symbolId,
  startDate,
  endDate,
}: GetHistoricalQuotesParams) {
  if (!symbolId.trim()) {
    throw new Error("symbolId is required");
  }

  const resolvedEnd = endDate ? parseISO(endDate) : new Date();
  if (Number.isNaN(resolvedEnd.getTime())) {
    throw new Error("endDate is invalid");
  }

  const resolvedStart = startDate
    ? parseISO(startDate)
    : addDays(resolvedEnd, -DEFAULT_WINDOW_DAYS);
  if (Number.isNaN(resolvedStart.getTime())) {
    throw new Error("startDate is invalid");
  }

  if (resolvedStart > resolvedEnd) {
    throw new Error("startDate must be before or equal to endDate");
  }

  const totalDays = differenceInCalendarDays(resolvedEnd, resolvedStart) + 1;
  if (totalDays > MAX_WINDOW_DAYS) {
    throw new Error(
      `Date range is too large. Maximum supported window is ${MAX_WINDOW_DAYS} days.`,
    );
  }

  const requests = [];
  for (
    let cursor = resolvedStart;
    cursor <= resolvedEnd;
    cursor = addDays(cursor, 1)
  ) {
    requests.push({ symbolId, date: cursor });
  }

  // Avoid caching ad-hoc AI lookups into the primary quotes table
  const quotesMap = await fetchQuotes(requests, false);

  const series = requests.map(({ date }) => {
    const dateString = format(date, "yyyy-MM-dd");
    const price = quotesMap.get(`${symbolId}|${dateString}`) ?? null;

    return {
      date: dateString,
      price,
      source: "yahoo-finance",
      status: price !== null ? "ok" : "missing",
    };
  });

  return {
    symbolId,
    startDate: format(resolvedStart, "yyyy-MM-dd"),
    endDate: format(resolvedEnd, "yyyy-MM-dd"),
    points: series,
    metadata: {
      totalDays,
      retrievedAt: new Date().toISOString(),
    },
  };
}
