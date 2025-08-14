"use server";

import { createServiceClient } from "@/supabase/service";

/**
 * Fetch all supported currencies
 */
export async function fetchCurrencies() {
  const supabase = await createServiceClient();

  const { data: currencies, error } = await supabase
    .from("currencies")
    .select("alphabetic_code, name")
    .order("alphabetic_code", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch currencies: ${error.message}`);
  }

  return currencies;
}
