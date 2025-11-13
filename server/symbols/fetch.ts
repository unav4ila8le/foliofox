"use server";

import { createServiceClient } from "@/supabase/service";
import { createClient } from "@/supabase/server";

/**
 * Fetch all unique symbol IDs from the database.
 * Used by cron jobs to get all symbols that need quote updates.
 *
 * @returns Array of unique symbol IDs
 */
export async function fetchSymbols() {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.from("symbols").select("id");

  if (error) {
    throw new Error(`Failed to fetch symbols: ${error.message}`);
  }

  return data?.map((symbol) => symbol.id) || [];
}

/**
 * Fetch a symbol by its ID
 *
 * @param symbolId - The ID of the symbol to fetch
 * @returns The symbol
 */
export async function fetchSymbol(symbolId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("symbols")
    .select("*")
    .eq("id", symbolId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch symbol: ${error.message}`);
  }

  return data;
}
