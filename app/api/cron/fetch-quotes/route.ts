import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { buildDateWindow, type CronDateStats } from "@/server/cron/shared";
import { fetchSymbols } from "@/server/symbols/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { chunkArray } from "@/server/shared/chunk-array";
import {
  isTransientError,
  retryWithBackoff,
  stringifyError,
} from "@/server/shared/retry";

export const maxDuration = 800;

interface QuoteCronDateStats extends CronDateStats {
  exactDateMatches: number;
  fallbackResolutions: number;
}

interface QuoteBatchStats {
  successfulFetches: number;
  failedFetches: number;
  retryCount: number;
  failedBatchCount: number;
  exactDateMatches: number;
  fallbackResolutions: number;
}

// Cron backfills should keep D, D-1, D-2 distinct and never remap today->yesterday.
const CRON_BACKFILL_CUTOFF_HOUR_UTC = 0;
const BACKFILL_WINDOW_DAYS = 3;
const RETRY_MAX_ATTEMPTS = 3;
const QUOTE_FETCH_BATCH_SIZE = 150;
const QUOTE_FETCH_CONCURRENCY = 4;

export async function GET(request: NextRequest) {
  // Wait for incoming request before continuing (prevents prerendering)
  await connection();

  try {
    // 1. Security check: Verify the request is from Vercel Cron
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured for quote fetch cron");

      return new Response("Server misconfigured", {
        status: 500,
      });
    }

    const authHeader = (await headers()).get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    // 2. Log start
    console.log("Starting daily quote fetch cron job...");

    // 3. Get date (from query param, default to today UTC)
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? formatUTCDateKey(new Date());
    const parsedDate = parseUTCDateKey(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid date. Expected YYYY-MM-DD.",
        },
        { status: 400 },
      );
    }

    const dateWindow = buildDateWindow(parsedDate, BACKFILL_WINDOW_DAYS);

    // 4. Fetch all symbols from database
    const symbols = await fetchSymbols();
    if (symbols.length === 0) {
      console.warn("No symbols found in database");

      const perDateStats: QuoteCronDateStats[] = dateWindow.map(
        (windowDate) => ({
          date: formatUTCDateKey(windowDate),
          totalRequests: 0,
          successfulFetches: 0,
          failedFetches: 0,
          retryCount: 0,
          failedBatchCount: 0,
          exactDateMatches: 0,
          fallbackResolutions: 0,
        }),
      );

      return NextResponse.json({
        success: true,
        message: "No symbols to fetch",
        stats: {
          totalSymbols: 0,
          resolvedRequests: 0,
          successfulFetches: 0,
          exactDateMatches: 0,
          fallbackResolutions: 0,
          failedFetches: 0,
          retryCount: 0,
          failedBatchCount: 0,
          windowDays: BACKFILL_WINDOW_DAYS,
          date,
          perDate: perDateStats,
        },
      });
    }

    const tickerBySymbolId = new Map(
      symbols.map((symbol) => [symbol.id, symbol.ticker]),
    );
    const perDateStats: QuoteCronDateStats[] = [];

    // 5. Fetch quotes for D, D-1, and D-2 with per-batch retries.
    for (const targetDate of dateWindow) {
      const dateKey = formatUTCDateKey(targetDate);
      const quoteRequests = symbols.map((symbol) => ({
        symbolLookup: symbol.id,
        date: targetDate,
      }));
      const requestBatches = chunkArray(quoteRequests, QUOTE_FETCH_BATCH_SIZE);

      const dateStats: QuoteCronDateStats = {
        date: dateKey,
        totalRequests: quoteRequests.length,
        successfulFetches: 0,
        failedFetches: 0,
        retryCount: 0,
        failedBatchCount: 0,
        exactDateMatches: 0,
        fallbackResolutions: 0,
      };

      const batchStats: QuoteBatchStats[] = new Array(requestBatches.length);
      let nextBatchIndex = 0;

      const processNextBatch = async () => {
        while (nextBatchIndex < requestBatches.length) {
          const batchIndex = nextBatchIndex;
          nextBatchIndex += 1;
          const requestBatch = requestBatches[batchIndex];
          let batchRetryCount = 0;
          const batchResolutionStats = {
            exactDateMatches: 0,
            fallbackResolutions: 0,
          };

          try {
            const quotesMap = await retryWithBackoff(
              () =>
                fetchQuotes(requestBatch, {
                  upsert: true,
                  staleGuardDays: 0,
                  // Preserve rolling-window distinctness in cron backfills.
                  cronCutoffHourUtc: CRON_BACKFILL_CUTOFF_HOUR_UTC,
                  liveMissCooldownMinutes: 0,
                  resolutionStats: batchResolutionStats,
                }),
              {
                maxAttempts: RETRY_MAX_ATTEMPTS,
                shouldRetry: isTransientError,
                onRetry: () => {
                  batchRetryCount += 1;
                },
              },
            );

            const failedTickers = requestBatch.flatMap((request) =>
              quotesMap.has(`${request.symbolLookup}|${dateKey}`)
                ? []
                : [
                    tickerBySymbolId.get(request.symbolLookup) ??
                      request.symbolLookup,
                  ],
            );

            if (failedTickers.length > 0) {
              console.warn(
                `[quote-cron] unresolved date=${dateKey} batch=${batchIndex + 1}/${requestBatches.length} count=${failedTickers.length} symbols=${failedTickers.join(",")}`,
              );
            }

            batchStats[batchIndex] = {
              successfulFetches: quotesMap.size,
              failedFetches: failedTickers.length,
              retryCount: batchRetryCount,
              failedBatchCount: 0,
              exactDateMatches: batchResolutionStats.exactDateMatches,
              fallbackResolutions: batchResolutionStats.fallbackResolutions,
            };
          } catch (error) {
            const failedTickers = requestBatch.map(
              (request) =>
                tickerBySymbolId.get(request.symbolLookup) ??
                request.symbolLookup,
            );
            console.warn(
              `[quote-cron] unresolved date=${dateKey} batch=${batchIndex + 1}/${requestBatches.length} count=${failedTickers.length} symbols=${failedTickers.join(",")} error=${stringifyError(error)}`,
            );

            batchStats[batchIndex] = {
              successfulFetches: 0,
              failedFetches: requestBatch.length,
              retryCount: batchRetryCount,
              failedBatchCount: 1,
              exactDateMatches: 0,
              fallbackResolutions: 0,
            };
          }
        }
      };

      await Promise.all(
        Array.from(
          {
            length: Math.min(QUOTE_FETCH_CONCURRENCY, requestBatches.length),
          },
          () => processNextBatch(),
        ),
      );

      batchStats.forEach((stats) => {
        dateStats.successfulFetches += stats.successfulFetches;
        dateStats.failedFetches += stats.failedFetches;
        dateStats.retryCount += stats.retryCount;
        dateStats.failedBatchCount += stats.failedBatchCount;
        dateStats.exactDateMatches += stats.exactDateMatches;
        dateStats.fallbackResolutions += stats.fallbackResolutions;
      });

      perDateStats.push(dateStats);
    }

    const successfulFetches = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.successfulFetches,
      0,
    );
    const exactDateMatches = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.exactDateMatches,
      0,
    );
    const fallbackResolutions = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.fallbackResolutions,
      0,
    );
    const failedFetches = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.failedFetches,
      0,
    );
    const retryCount = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.retryCount,
      0,
    );
    const failedBatchCount = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.failedBatchCount,
      0,
    );
    const hasFailures = failedFetches > 0 || failedBatchCount > 0;

    // 6. Log and return stats
    console.log(
      `Quote fetch completed for ${date}: ${successfulFetches} successful, ${failedFetches} failed, ${retryCount} retries.`,
    );

    return NextResponse.json({
      success: true,
      message: hasFailures
        ? "Daily quote fetch completed with partial failures"
        : "Daily quote fetch completed",
      stats: {
        totalSymbols: symbols.length,
        resolvedRequests: successfulFetches,
        successfulFetches,
        exactDateMatches,
        fallbackResolutions,
        failedFetches,
        retryCount,
        failedBatchCount,
        windowDays: BACKFILL_WINDOW_DAYS,
        date,
        perDate: perDateStats,
      },
    });
  } catch (error) {
    console.error("Quote cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
