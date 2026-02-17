import { NextRequest, NextResponse, connection } from "next/server";
import { headers } from "next/headers";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { fetchCurrencies } from "@/server/currencies/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

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

    // 4. Fetch all currency codes from Supabase
    const currencies = await fetchCurrencies();

    // 5. Prepare rate requests for the target date
    const rateRequests = currencies.map((currency) => ({
      currency: currency.alphabetic_code,
      date: parsedDate,
    }));

    // 6. Fetch exchange rates using your existing function
    const ratesMap = await fetchExchangeRates(rateRequests, {
      upsert: true,
      staleGuardDays: 0,
    });

    // 7. Count successful fetches
    const successfulFetches = ratesMap.size;
    const failedFetches = currencies.length - successfulFetches;

    // 8. Log and return stats
    console.log(
      `Exchange rates fetch completed for ${date}: ${successfulFetches} successful, ${failedFetches} failed.`,
    );

    return NextResponse.json({
      success: true,
      message: "Daily exchange rates fetch completed",
      stats: {
        totalCurrencies: currencies.length,
        successfulFetches,
        failedFetches,
        date,
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
