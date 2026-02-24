import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import {
  addUTCDays,
  formatUTCDateKey,
  parseUTCDateKey,
} from "@/lib/date/date-utils";
import { fetchCurrencies } from "@/server/currencies/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import { isTransientError, retryWithBackoff } from "@/server/shared/retry";

const CRON_CUTOFF_HOUR_UTC = 22;
const BACKFILL_WINDOW_DAYS = 3;
const RETRY_MAX_ATTEMPTS = 3;

interface CronDateStats {
  date: string;
  totalRequests: number;
  successfulFetches: number;
  failedFetches: number;
  retryCount: number;
  failedBatchCount: number;
}

// Builds an array of dates from the anchor date minus the number of days in the backfill window
function buildDateWindow(anchorDate: Date): Date[] {
  return Array.from({ length: BACKFILL_WINDOW_DAYS }, (_, offset) =>
    addUTCDays(anchorDate, -offset),
  );
}

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
    console.log("Starting daily exchange rate fetch cron job...");

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

    const dateWindow = buildDateWindow(parsedDate);

    // 4. Fetch all currency codes from Supabase
    const currencies = await fetchCurrencies();
    const currencyCodes = currencies.map(
      (currency) => currency.alphabetic_code,
    );
    const perDateStats: CronDateStats[] = [];

    // 5. Fetch exchange-rate cache for D, D-1, and D-2.
    for (const targetDate of dateWindow) {
      const dateKey = formatUTCDateKey(targetDate);
      const rateRequests = currencyCodes.map((currency) => ({
        currency,
        date: targetDate,
      }));

      const dateStats: CronDateStats = {
        date: dateKey,
        totalRequests: rateRequests.length,
        successfulFetches: 0,
        failedFetches: 0,
        retryCount: 0,
        failedBatchCount: 0,
      };

      let retryCountForDate = 0;
      try {
        const ratesMap = await retryWithBackoff(
          () =>
            fetchExchangeRates(rateRequests, {
              upsert: true,
              staleGuardDays: 0,
              cronCutoffHourUtc: CRON_CUTOFF_HOUR_UTC,
            }),
          {
            maxAttempts: RETRY_MAX_ATTEMPTS,
            shouldRetry: isTransientError,
            onRetry: () => {
              retryCountForDate += 1;
            },
          },
        );

        dateStats.successfulFetches = ratesMap.size;
        dateStats.failedFetches = rateRequests.length - ratesMap.size;
      } catch (error) {
        dateStats.failedFetches = rateRequests.length;
        dateStats.failedBatchCount = 1;
        console.warn(`FX fetch failed for ${dateKey}:`, error);
      } finally {
        dateStats.retryCount = retryCountForDate;
      }

      perDateStats.push(dateStats);
    }

    const successfulFetches = perDateStats.reduce(
      (sum, dateStats) => sum + dateStats.successfulFetches,
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
      `Exchange rates fetch completed for ${date}: ${successfulFetches} successful, ${failedFetches} failed, ${retryCount} retries.`,
    );

    return NextResponse.json({
      success: true,
      message: hasFailures
        ? "Daily exchange rates fetch completed with partial failures"
        : "Daily exchange rates fetch completed",
      stats: {
        totalCurrencies: currencyCodes.length,
        successfulFetches,
        failedFetches,
        retryCount,
        failedBatchCount,
        windowDays: BACKFILL_WINDOW_DAYS,
        date,
        perDate: perDateStats,
      },
    });
  } catch (error) {
    console.error("Exchange rates cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
