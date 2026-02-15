import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { fetchSymbols } from "@/server/symbols/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";

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

    // 4. Fetch all symbol IDs from database
    const symbolIds = await fetchSymbols();
    if (symbolIds.length === 0) {
      console.warn("No symbols found in database");
      return NextResponse.json({
        success: true,
        message: "No symbols to fetch",
        stats: {
          totalSymbols: 0,
          successfulFetches: 0,
          failedFetches: 0,
          date,
        },
      });
    }

    // 5. Prepare quote requests for the target date
    const quoteRequests = symbolIds.map((symbolId) => ({
      symbolLookup: symbolId,
      date: parsedDate,
    }));

    // 6. Fetch quotes using your existing function
    const quotesMap = await fetchQuotes(quoteRequests, {
      upsert: true,
      staleGuardDays: 0,
    });

    // 7. Count successful fetches
    const successfulFetches = quotesMap.size;
    const failedFetches = symbolIds.length - successfulFetches;

    // 8. Log and return stats
    console.log(
      `Quote fetch completed for ${date}: ${successfulFetches} successful, ${failedFetches} failed.`,
    );

    return NextResponse.json({
      success: true,
      message: "Daily quote fetch completed",
      stats: {
        totalSymbols: symbolIds.length,
        successfulFetches,
        failedFetches,
        date,
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
