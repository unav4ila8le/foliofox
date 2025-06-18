"use server";

import { format } from "date-fns";
import yahooFinance from "yahoo-finance2";

import { createClient } from "@/utils/supabase/server";

// Fetch a specific quote for a symbol on a date
export async function fetchQuote(symbolId: string, date: Date = new Date()) {
  // Supabase client
  const supabase = await createClient();
  const dateString = format(date, "yyyy-MM-dd");

  // 1. Try to get the quote for the exact date
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("price")
    .eq("symbol_id", symbolId)
    .eq("date", dateString)
    .single();

  if (error || !quote) {
    // 2. Fetch from Yahoo Finance and create the quote
    const historicalData = await yahooFinance.historical(symbolId, {
      period1: dateString,
      period2: dateString,
      interval: "1d",
    });

    if (!historicalData || historicalData.length === 0) {
      throw new Error(
        `No historical data found for ${symbolId} on ${dateString}`,
      );
    }

    const price = historicalData[0].adjClose || historicalData[0].close;

    if (!price || price <= 0) {
      console.warn(`No valid price data for ${symbolId} on ${dateString}`);
      throw new Error(
        `No valid price data available for ${symbolId} on ${dateString}`,
      );
    }

    // Insert the quote
    const { error: insertError } = await supabase.from("quotes").upsert({
      symbol_id: symbolId,
      date: dateString,
      price: price,
    });

    if (insertError) {
      throw new Error(`Failed to insert quote: ${insertError.message}`);
    }

    // 3. Query the database again for the exact date
    const { data: retryQuote, error: retryError } = await supabase
      .from("quotes")
      .select("price")
      .eq("symbol_id", symbolId)
      .lte("date", dateString)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (!retryQuote || retryError) {
      throw new Error(
        `No quote found for ${symbolId} on ${dateString} after insertion`,
      );
    }

    return retryQuote.price;
  }

  return quote.price;
}
