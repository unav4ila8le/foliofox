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
 * Fetch canonical symbol IDs referenced by any position (active or archived).
 * Used by quote prewarm jobs so historical net worth symbols are included.
 *
 * @returns Sorted array of unique symbol IDs
 */
export async function fetchPositionSymbols() {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("positions")
    .select("symbol_id")
    .not("symbol_id", "is", null);

  if (error) {
    throw new Error(`Failed to fetch position symbols: ${error.message}`);
  }

  const unique = new Set<string>();
  data?.forEach((row) => {
    if (row.symbol_id) {
      unique.add(row.symbol_id);
    }
  });

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

/**
 * Purge symbols that are not linked to any position.
 *
 * This is useful before a quote prewarm run to reduce unnecessary provider calls.
 * Related rows in quotes/dividends/dividend_events/aliases are removed via CASCADE.
 *
 * @returns Number of deleted symbols
 */
export async function purgeUnlinkedSymbols() {
  const supabase = await createServiceClient();

  const { data: symbolRows, error: symbolError } = await supabase
    .from("symbols")
    .select("id");

  if (symbolError) {
    throw new Error(`Failed to list symbols for purge: ${symbolError.message}`);
  }

  if (!symbolRows?.length) return 0;

  const { data: linkedRows, error: linkedError } = await supabase
    .from("positions")
    .select("symbol_id")
    .not("symbol_id", "is", null);

  if (linkedError) {
    throw new Error(
      `Failed to list linked symbols for purge: ${linkedError.message}`,
    );
  }

  const linkedIds = new Set<string>();
  linkedRows?.forEach((row) => {
    if (row.symbol_id) {
      linkedIds.add(row.symbol_id);
    }
  });

  const orphanSymbolIds = symbolRows
    .map((row) => row.id)
    .filter((symbolId) => !linkedIds.has(symbolId));

  if (!orphanSymbolIds.length) return 0;

  const DELETE_CHUNK_SIZE = 1000;
  let deletedCount = 0;

  for (
    let index = 0;
    index < orphanSymbolIds.length;
    index += DELETE_CHUNK_SIZE
  ) {
    const chunk = orphanSymbolIds.slice(index, index + DELETE_CHUNK_SIZE);
    const { error: deleteError } = await supabase
      .from("symbols")
      .delete()
      .in("id", chunk);

    if (deleteError) {
      throw new Error(`Failed to purge orphan symbols: ${deleteError.message}`);
    }

    deletedCount += chunk.length;
  }

  return deletedCount;
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
