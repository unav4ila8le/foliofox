import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import {
  addUTCDays,
  formatUTCDateKey,
  parseUTCDateKey,
  startOfUTCDay,
} from "@/lib/date/date-utils";
import { fetchQuotes } from "@/server/quotes/fetch";
import {
  fetchActivePositionSymbols,
  purgeUnlinkedSymbols,
} from "@/server/symbols/fetch";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const DEFAULT_DAYS_BACK = 365;
const MAX_DAYS_BACK = 730;

function parseIntegerWithBounds(params: {
  rawValue: string | null;
  fallback: number;
  min: number;
  max: number;
}) {
  const { rawValue, fallback, min, max } = params;
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, parsed));
}

function parseBooleanFlag(rawValue: string | null): boolean {
  if (!rawValue) return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(request: NextRequest) {
  // Wait for incoming request before continuing (prevents prerendering)
  await connection();

  try {
    // 1. Security check: Verify the request is authorized
    const expectedSecret =
      process.env.PREWARM_SECRET ?? process.env.CRON_SECRET ?? null;
    if (!expectedSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Server misconfiguration: missing PREWARM_SECRET/CRON_SECRET.",
        },
        { status: 500 },
      );
    }

    const authHeader = (await headers()).get("authorization");
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse route options
    const url = new URL(request.url);
    const cursor = parseIntegerWithBounds({
      rawValue: url.searchParams.get("cursor"),
      fallback: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    const batchSize = parseIntegerWithBounds({
      rawValue: url.searchParams.get("batchSize"),
      fallback: DEFAULT_BATCH_SIZE,
      min: 1,
      max: MAX_BATCH_SIZE,
    });
    const daysBack = parseIntegerWithBounds({
      rawValue: url.searchParams.get("daysBack"),
      fallback: DEFAULT_DAYS_BACK,
      min: 1,
      max: MAX_DAYS_BACK,
    });
    const purgeOrphans = parseBooleanFlag(url.searchParams.get("purgeOrphans"));

    const endDateKeyParam = url.searchParams.get("date");
    const parsedEndDate = endDateKeyParam
      ? parseUTCDateKey(endDateKeyParam)
      : startOfUTCDay(new Date());
    if (Number.isNaN(parsedEndDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid date. Expected YYYY-MM-DD.",
        },
        { status: 400 },
      );
    }

    // 3. Optional one-time orphan purge before first batch
    let purgedOrphanSymbols = 0;
    if (purgeOrphans && cursor === 0) {
      purgedOrphanSymbols = await purgeUnlinkedSymbols();
    }

    // 4. Load active symbols and resolve current batch
    const activeSymbolIds = await fetchActivePositionSymbols();
    const totalSymbols = activeSymbolIds.length;

    if (cursor >= totalSymbols) {
      console.log(
        `[prewarm-quotes] completed (no batch work). totalSymbols=${totalSymbols}, cursor=${cursor}, purgedOrphanSymbols=${purgedOrphanSymbols}`,
      );

      return NextResponse.json({
        success: true,
        message: "Quote prewarm complete.",
        stats: {
          totalSymbols,
          cursor,
          batchSize,
          daysBack,
          processedSymbols: 0,
          expectedRequests: 0,
          resolvedRequests: 0,
          unresolvedRequests: 0,
          nextCursor: null,
          startDate: formatUTCDateKey(
            addUTCDays(parsedEndDate, -(daysBack - 1)),
          ),
          endDate: formatUTCDateKey(parsedEndDate),
          purgedOrphanSymbols,
        },
      });
    }

    const batchSymbolIds = activeSymbolIds.slice(cursor, cursor + batchSize);
    const startDate = addUTCDays(parsedEndDate, -(daysBack - 1));

    // 5. Build quote requests for this batch
    const quoteRequests: Array<{ symbolLookup: string; date: Date }> = [];
    for (const symbolId of batchSymbolIds) {
      for (let dayOffset = 0; dayOffset < daysBack; dayOffset += 1) {
        quoteRequests.push({
          symbolLookup: symbolId,
          date: addUTCDays(startDate, dayOffset),
        });
      }
    }

    // 6. Execute prewarm using strict cache-miss behavior
    const quotesMap = await fetchQuotes(quoteRequests, {
      upsert: true,
      staleGuardDays: 0,
    });

    const processedSymbols = batchSymbolIds.length;
    const expectedRequests = quoteRequests.length;
    const resolvedRequests = quotesMap.size;
    const unresolvedRequests = Math.max(0, expectedRequests - resolvedRequests);
    const nextCursor =
      cursor + processedSymbols < totalSymbols
        ? cursor + processedSymbols
        : null;

    if (nextCursor === null) {
      console.log(
        `[prewarm-quotes] completed successfully. totalSymbols=${totalSymbols}, daysBack=${daysBack}, purgedOrphanSymbols=${purgedOrphanSymbols}`,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Quote prewarm batch completed.",
      stats: {
        totalSymbols,
        cursor,
        batchSize,
        daysBack,
        processedSymbols,
        expectedRequests,
        resolvedRequests,
        unresolvedRequests,
        nextCursor,
        startDate: formatUTCDateKey(startDate),
        endDate: formatUTCDateKey(parsedEndDate),
        purgedOrphanSymbols,
      },
    });
  } catch (error) {
    console.error("Quote prewarm route failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
