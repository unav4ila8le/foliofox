"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Fetch a specific exchange rate from USD to target currency.
 * Used for converting holding values to USD for net worth and other calculations.
 */
export async function fetchExchangeRate(
  targetCurrency: string,
  date: Date = new Date(),
): Promise<number> {
  // Check if target currency is USD
  if (targetCurrency === "USD") {
    return 1;
  }

  // Supabase client
  const supabase = await createClient();
  const dateString = date.toISOString().slice(0, 10);

  // 1. Try to get the exchange rate for the exact date
  const { data: rate, error } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base_currency", "USD")
    .eq("target_currency", targetCurrency)
    .eq("date", dateString)
    .single();

  if (error || !rate) {
    // 2. Call the edge function to fetch and insert the missing rate
    const edgeUrl = `https://icnvjrvkdjtbnldhootf.supabase.co/functions/v1/fetch-exchange-rates?date=${dateString}`;
    const jwt = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const edgeResponse = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!edgeResponse.ok) {
      throw new Error(
        `Edge function failed: ${edgeResponse.status} ${edgeResponse.statusText}`,
      );
    }

    // 3. Query the database again for the exact date
    const { data: retryRate, error: retryError } = await supabase
      .from("exchange_rates")
      .select("rate")
      .eq("base_currency", "USD")
      .eq("target_currency", targetCurrency)
      .lte("date", dateString)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (!retryRate || retryError) {
      throw new Error(
        `No exchange rate found for ${targetCurrency} on ${dateString} after edge function call`,
      );
    }

    return retryRate.rate;
  }

  return rate.rate;
}
