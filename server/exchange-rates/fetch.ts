"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Fetch a specific exchange rate from USD to target currency.
 * Used for converting holding values to USD for net worth and other calculations.
 */
export async function fetchExchangeRate(
  targetCurrency: string,
  date?: Date,
): Promise<number> {
  // Check if target currency is USD
  if (targetCurrency === "USD") {
    return 1;
  }

  // Supabase client
  const supabase = await createClient();

  // If no date is provided, get the most recent rate
  if (!date) {
    const { data: latestRate, error: latestError } = await supabase
      .from("exchange_rates")
      .select("rate")
      .eq("base_currency", "USD")
      .eq("target_currency", targetCurrency)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    // Throw error
    if (latestError) {
      throw new Error(
        `Failed to fetch latest exchange rate for ${targetCurrency}: ${latestError.message}`,
      );
    }

    return latestRate.rate;
  }

  // If date is provided, get the rate for that specific date
  // Format date to YYYY-MM-DD
  const formattedDate = date.toISOString().split("T")[0];

  // Get specific exchange rate
  const { data: rate, error } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("date", formattedDate)
    .eq("base_currency", "USD")
    .eq("target_currency", targetCurrency)
    .single();

  // Throw error
  if (error) {
    throw new Error(
      `Failed to fetch exchange rate for ${targetCurrency} on ${formattedDate}: ${error.message}`,
    );
  }

  return rate.rate;
}
