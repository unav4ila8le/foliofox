"use server";

import { format } from "date-fns";
import yahooFinance from "yahoo-finance2";

import { createClient } from "@/utils/supabase/server";

/**
 * Fetch a quote price for a symbol on a specific date.
 *
 * This function implements a caching strategy:
 * 1. First, try to get the quote from our database
 * 2. If not found, fetch from Yahoo Finance using the chart() method
 * 3. For historical dates, use the quotes array for accurate historical prices
 * 4. For current/future dates, fall back to regularMarketPrice when quotes is empty
 * 5. Cache the result in our database for future requests
 *
 * @param symbolId - The stock symbol (e.g., "AAPL", "BTC-USD")
 * @param date - The date to fetch the quote for (defaults to today)
 * @returns The price for the symbol on the given date
 */
export async function fetchQuote(symbolId: string, date: Date = new Date()) {
  const supabase = await createClient();
  const dateString = format(date, "yyyy-MM-dd");

  // 1. Try to get the quote from our database first
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("price")
    .eq("symbol_id", symbolId)
    .eq("date", dateString)
    .single();

  if (error || !quote) {
    // 2. Fetch from Yahoo Finance using chart method
    const chartData = await yahooFinance.chart(symbolId, {
      period1: dateString,
      interval: "1d",
    });

    if (!chartData) {
      throw new Error(`No chart data found for ${symbolId} on ${dateString}`);
    }

    let price;

    // Try to get price from quotes array first (for historical data)
    if (chartData.quotes && chartData.quotes.length > 0) {
      const latestQuote = chartData.quotes[chartData.quotes.length - 1];
      price = latestQuote.adjclose ?? latestQuote.close;
    }
    // If quotes array is empty, use regularMarketPrice from meta (for current/future dates)
    else if (chartData.meta && chartData.meta.regularMarketPrice) {
      price = chartData.meta.regularMarketPrice;
    }
    // No price data available
    else {
      throw new Error(
        `No price data available for ${symbolId} on ${dateString}`,
      );
    }

    if (!price || price <= 0) {
      throw new Error(
        `No valid price data available for ${symbolId} on ${dateString}`,
      );
    }

    // 3. Insert the quote in our database with conflict resolution
    const { error: insertError } = await supabase.from("quotes").upsert(
      {
        symbol_id: symbolId,
        date: dateString,
        price: price,
      },
      {
        onConflict: "symbol_id,date",
      },
    );

    if (insertError) {
      throw new Error(`Failed to insert quote: ${insertError.message}`);
    }

    return price;
  }

  // 4. Return cached quote from database
  return quote.price;
}
