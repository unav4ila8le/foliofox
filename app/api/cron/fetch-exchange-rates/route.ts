import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/utils/supabase/service";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

export async function GET(request: NextRequest) {
  try {
    // 1. Security check: Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    // 2. Log start
    console.log("Starting daily exchange rate fetch cron job...");

    // 3. Get date (from query param, default to tomorrow)
    const url = new URL(request.url);
    const date =
      url.searchParams.get("date") ||
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      })();

    // 4. Fetch all currency codes from Supabase
    const supabase = createServiceClient();
    const { data: currencies, error: currenciesError } = await supabase
      .from("currencies")
      .select("alphabetic_code");
    if (currenciesError) {
      throw new Error(
        "Failed to fetch currency codes: " + currenciesError.message,
      );
    }

    // 5. Prepare rate requests for the target date
    const rateRequests = currencies.map((currency) => ({
      currency: currency.alphabetic_code,
      date: new Date(date),
    }));

    // 6. Fetch exchange rates using your existing function
    const ratesMap = await fetchExchangeRates(rateRequests);

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
