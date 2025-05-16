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
    throw new Error(error.message);
  }

  return rate.rate;
}
