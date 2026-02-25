import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { buildDateWindow, type CronDateStats } from "@/server/cron/shared";
import { fetchSymbols } from "@/server/symbols/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { chunkArray } from "@/server/shared/chunk-array";
import { isTransientError, retryWithBackoff } from "@/server/shared/retry";

interface QuoteCronDateStats extends CronDateStats {
  exactDateMatches: number;
  fallbackResolutions: number;
}

const QUOTE_FETCH_BATCH_SIZE = 150;
const BACKFILL_WINDOW_DAYS = 3;
const CRON_BACKFILL_CUTOFF_HOUR_UTC = 0;
const RETRY_MAX_ATTEMPTS = 3;

export async function GET(request: NextRequest) {
  // Wait for incoming request before continuing (prevents prerendering)
  await connection();

  try {
    // 1. Security check: Verify the request is from Vercel Cron
    const authHeader = (await headers()).get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    // 4. Fetch all symbol IDs from database
    const symbolIds = await fetchSymbols();
    if (symbolIds.length === 0) {
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

    const perDateStats: QuoteCronDateStats[] = [];

    // 5. Fetch quotes for D, D-1, and D-2 with per-batch retries.
    for (const targetDate of dateWindow) {
      const dateKey = formatUTCDateKey(targetDate);
      const quoteRequests = symbolIds.map((symbolId) => ({
        symbolLookup: symbolId,
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

      for (const [batchIndex, requestBatch] of requestBatches.entries()) {
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

          dateStats.successfulFetches += quotesMap.size;
          dateStats.exactDateMatches += batchResolutionStats.exactDateMatches;
          dateStats.fallbackResolutions +=
            batchResolutionStats.fallbackResolutions;
          dateStats.failedFetches += requestBatch.length - quotesMap.size;
        } catch (error) {
          dateStats.failedFetches += requestBatch.length;
          dateStats.failedBatchCount += 1;
          console.warn(
            `Quote fetch failed for ${dateKey} batch ${batchIndex + 1}/${requestBatches.length}:`,
            error,
          );
        } finally {
          dateStats.retryCount += batchRetryCount;
        }
      }

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
        totalSymbols: symbolIds.length,
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
