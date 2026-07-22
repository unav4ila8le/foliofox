"use server";

import { createServiceClient } from "@/supabase/service";
import { createClient } from "@/supabase/server";

const SYMBOL_PAGE_SIZE = 1_000;

export interface CronSymbol {
  id: string;
  ticker: string;
}

/**
 * Fetch canonical symbols with active Yahoo ticker aliases using keyset pagination.
 * Used by cron jobs to get symbols eligible for live quote updates.
 *
 * @returns Array of canonical symbol IDs and active Yahoo tickers
 */
export async function fetchSymbols(): Promise<CronSymbol[]> {
  const supabase = await createServiceClient();
  const symbolsById = new Map<
    string,
    { symbol: CronSymbol; effectiveFrom: string; aliasId: string }
  >();
  let cursor: string | null = null;

  while (true) {
    let query = supabase
      .from("symbol_aliases")
      .select("id, symbol_id, value, effective_from")
      .eq("source", "yahoo")
      .eq("type", "ticker")
      .is("effective_to", null)
      .order("id", { ascending: true })
      .limit(SYMBOL_PAGE_SIZE);

    if (cursor) {
      query = query.gt("id", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch symbols: ${error.message}`);
    }

    if (!data?.length) break;

    data.forEach((alias) => {
      const existing = symbolsById.get(alias.symbol_id);
      if (
        !existing ||
        alias.effective_from > existing.effectiveFrom ||
        (alias.effective_from === existing.effectiveFrom &&
          alias.id > existing.aliasId)
      ) {
        symbolsById.set(alias.symbol_id, {
          symbol: { id: alias.symbol_id, ticker: alias.value },
          effectiveFrom: alias.effective_from,
          aliasId: alias.id,
        });
      }
    });

    if (data.length < SYMBOL_PAGE_SIZE) break;
    cursor = data[data.length - 1].id;
  }

  return Array.from(symbolsById.values(), ({ symbol }) => symbol);
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
