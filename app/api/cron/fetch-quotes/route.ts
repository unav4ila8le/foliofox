import { NextRequest, NextResponse } from "next/server";

import { fetchSymbols } from "@/server/symbols/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";

export async function GET(request: NextRequest) {
  try {
    // Security: Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    console.log("Starting daily quote fetch cron job...");

    // 1. Get all symbol IDs from database
    const symbolIds = await fetchSymbols();

    if (symbolIds.length === 0) {
      console.log("No symbols found in database");
      return NextResponse.json({
        success: true,
        message: "No symbols to fetch",
        symbolCount: 0,
      });
    }

    console.log(`Found ${symbolIds.length} symbols to fetch quotes for`);

    // 2. Prepare requests for today's date
    const today = new Date();
    const quoteRequests = symbolIds.map((symbolId) => ({
      symbolId,
      date: today,
    }));

    // 3. Fetch quotes using your existing function
    const quotesMap = await fetchQuotes(quoteRequests);

    // 4. Count successful fetches
    const successfulFetches = quotesMap.size;
    const failedFetches = symbolIds.length - successfulFetches;

    console.log(`Quote fetch completed:`, {
      total: symbolIds.length,
      successful: successfulFetches,
      failed: failedFetches,
    });

    return NextResponse.json({
      success: true,
      message: "Daily quote fetch completed",
      stats: {
        totalSymbols: symbolIds.length,
        successfulFetches,
        failedFetches,
        date: today.toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
