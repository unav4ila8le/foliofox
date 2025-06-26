import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/utils/supabase/service";

const FRANKFURTER_API = "https://api.frankfurter.app";

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
    const symbols = currencies.map((row) => row.alphabetic_code);

    // 5. Fetch rates from Frankfurter API
    const base = "USD";
    const symbolsParam = symbols.join(",");
    const frankfurterUrl = `${FRANKFURTER_API}/${date}?base=${base}&symbols=${symbolsParam}`;
    const response = await fetch(frankfurterUrl);
    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.statusText}`);
    }
    const frankfurterData = await response.json();
    const rates = frankfurterData.rates;

    // 6. Insert rates into Supabase
    const rows = Object.entries(rates).map(([target_currency, rate]) => ({
      base_currency: base,
      target_currency,
      rate: Number(rate),
      date,
    }));
    const { error: insertError } = await supabase
      .from("exchange_rates")
      .upsert(rows, {
        onConflict: "base_currency,target_currency,date",
      });
    if (insertError) {
      throw new Error(
        "Failed to upsert exchange rates: " + insertError.message,
      );
    }

    // 7. Log and return stats
    console.log(
      `Exchange rates fetch completed for ${date}: ${Object.keys(rates).length} rates inserted.`,
    );

    return NextResponse.json({
      success: true,
      message: "Daily exchange rates fetch completed",
      stats: {
        base,
        date,
        totalCurrencies: symbols.length,
        insertedRates: Object.keys(rates).length,
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
