"use server";

import {
  addUTCDays,
  formatUTCDateKey,
  parseUTCDateKey,
  resolveTodayDateKey,
} from "@/lib/date/date-utils";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchProfile } from "@/server/profile/actions";
import { ensureSymbol } from "@/server/symbols/ensure";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const MAX_BATCH_SYMBOLS = 10;

type GetHistoricalQuotesParams = {
  symbolLookup: string;
  startDate: string | null;
  endDate: string | null;
};

type GetHistoricalQuotesBatchParams = {
  symbolLookups: string[];
  startDate: string | null;
  endDate: string | null;
};

interface ResolvedHistoricalSymbol {
  requestedLookup: string;
  canonicalId: string;
  displayTicker: string;
}

interface HistoricalDateWindow {
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

interface HistoricalQuotePoint {
  date: string;
  price: number | null;
  source: "yahoo-finance";
  status: "ok" | "missing";
}

async function resolveHistoricalDateWindow(
  startDate: string | null,
  endDate: string | null,
): Promise<HistoricalDateWindow> {
  // Resolve "today" from profile timezone when caller does not provide endDate.
  const resolvedEndDateKey =
    endDate ?? resolveTodayDateKey((await fetchProfile()).profile.time_zone);
  const resolvedEnd = parseUTCDateKey(resolvedEndDateKey);
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

  // Clamp oversized lookbacks instead of failing the entire request.
  const maxLookbackStart = addUTCDays(resolvedEnd, -(MAX_WINDOW_DAYS - 1));
  const effectiveStart =
    resolvedStart < maxLookbackStart ? maxLookbackStart : resolvedStart;

  const totalDays =
    Math.floor((resolvedEnd.getTime() - effectiveStart.getTime()) / 86400000) +
    1;

  return {
    startDate: effectiveStart,
    endDate: resolvedEnd,
    totalDays,
  };
}

function buildHistoricalDateSeries({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}): Date[] {
  const dates: Date[] = [];
  for (
    let cursor = startDate;
    cursor <= endDate;
    cursor = addUTCDays(cursor, 1)
  ) {
    dates.push(cursor);
  }

  return dates;
}

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

  const window = await resolveHistoricalDateWindow(startDate, endDate);

  const requests = [];
  for (
    let cursor = window.startDate;
    cursor <= window.endDate;
    cursor = addUTCDays(cursor, 1)
  ) {
    requests.push({ symbolLookup: canonicalId, date: cursor });
  }

  // Avoid caching ad-hoc AI lookups into the primary quotes table
  const quotesMap = await fetchQuotes(requests, {
    upsert: false,
  });

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
    startDate: formatUTCDateKey(window.startDate),
    endDate: formatUTCDateKey(window.endDate),
    points: series,
    metadata: {
      totalDays: window.totalDays,
      retrievedAt: new Date().toISOString(),
    },
  };
}

export async function getHistoricalQuotesBatch({
  symbolLookups,
  startDate,
  endDate,
}: GetHistoricalQuotesBatchParams) {
  const normalizedLookups = symbolLookups
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const uniqueLookups = [...new Set(normalizedLookups)];

  if (uniqueLookups.length === 0) {
    throw new Error("At least one symbol lookup is required");
  }

  if (uniqueLookups.length > MAX_BATCH_SYMBOLS) {
    throw new Error(
      `Too many symbols requested. Maximum supported batch size is ${MAX_BATCH_SYMBOLS}.`,
    );
  }

  const window = await resolveHistoricalDateWindow(startDate, endDate);
  const dates = buildHistoricalDateSeries(window);

  const resolutionResults = await Promise.all(
    uniqueLookups.map(async (lookup) => {
      const ensuredSymbol = await ensureSymbol(lookup);
      if (!ensuredSymbol?.symbol?.id) {
        return {
          ok: false as const,
          requestedLookup: lookup,
          error: `Symbol "${lookup}" not found.`,
        };
      }

      return {
        ok: true as const,
        symbol: {
          requestedLookup: lookup,
          canonicalId: ensuredSymbol.symbol.id,
          displayTicker:
            ensuredSymbol.primaryAlias?.value ??
            ensuredSymbol.symbol.ticker ??
            lookup,
        } satisfies ResolvedHistoricalSymbol,
      };
    }),
  );

  const resolvedSymbols = resolutionResults
    .filter((result) => result.ok)
    .map((result) => result.symbol);
  const unresolved = resolutionResults
    .filter((result) => !result.ok)
    .map(({ requestedLookup, error }) => ({ requestedLookup, error }));

  if (resolvedSymbols.length === 0) {
    throw new Error(
      unresolved[0]?.error ?? "No symbols could be resolved for batch quotes.",
    );
  }

  const quoteRequests = resolvedSymbols.flatMap((symbol) =>
    dates.map((date) => ({ symbolLookup: symbol.canonicalId, date })),
  );

  // Fetch all requested symbol/date points in one pass to avoid N tool calls.
  const quotesMap = await fetchQuotes(quoteRequests, {
    upsert: false,
  });

  const symbols = resolvedSymbols.map((symbol) => {
    // Build final points in one pass (no intermediate "missing points" scaffold).
    const points = dates.map((date) => {
      const dateString = formatUTCDateKey(date);
      const price =
        quotesMap.get(`${symbol.canonicalId}|${dateString}`) ??
        quotesMap.get(`${symbol.requestedLookup}|${dateString}`) ??
        null;

      return {
        date: dateString,
        price,
        source: "yahoo-finance",
        status: price !== null ? "ok" : "missing",
      } satisfies HistoricalQuotePoint;
    });

    return {
      requestedLookup: symbol.requestedLookup,
      symbolId: symbol.canonicalId,
      symbolTicker: symbol.displayTicker,
      points,
    };
  });

  return {
    startDate: formatUTCDateKey(window.startDate),
    endDate: formatUTCDateKey(window.endDate),
    symbols,
    unresolved,
    metadata: {
      requestedSymbols: uniqueLookups.length,
      resolvedSymbols: resolvedSymbols.length,
      unresolvedSymbols: unresolved.length,
      totalDays: window.totalDays,
      retrievedAt: new Date().toISOString(),
    },
  };
}
