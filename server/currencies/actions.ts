"use server";

import { createClient } from "@/utils/supabase/server";

import type { Currency } from "@/types/global.types";

export async function fetchCurrencies(): Promise<Currency[]> {
  // Supabase client
  const supabase = await createClient();

  // Get currencies
  const { data: currencies, error } = await supabase
    .from("currencies")
    .select("alphabetic_code")
    .order("alphabetic_code", { ascending: true });

  // Throw error
  if (error) {
    throw new Error(error.message);
  }

  return currencies;
}
