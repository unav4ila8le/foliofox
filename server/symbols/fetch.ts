"use server";

import { createServiceClient } from "@/utils/supabase/service";

/**
 * Fetch all unique symbol IDs from the database.
 * Used by cron jobs to get all symbols that need quote updates.
 *
 * @returns Array of unique symbol IDs
 */
export async function fetchSymbols() {
  const supabase = await createServiceClient();

  try {
    console.log("Fetching symbols from database...");

    const { data: symbols, error } = await supabase
      .from("symbols")
      .select("id");
    console.log("Symbols query result:", {
      symbols,
      error,
      count: symbols?.length,
    });

    if (error) {
      throw new Error(`Failed to fetch symbols: ${error.message}`);
    }

    return symbols?.map((symbol) => symbol.id) || [];
  } catch (error) {
    throw new Error(
      `Failed to fetch symbol IDs: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
