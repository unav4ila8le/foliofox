"use server";

import { getCurrentUser } from "@/server/auth/actions";

const STALENESS_THRESHOLD_DAYS = 7;

export type StalePosition = {
  positionId: string;
  ticker: string;
};

/**
 * Fetch positions that have stale symbols (last_quote_at is NULL or > 7 days old).
 * Only includes non-archived positions with a symbol_id.
 */
export async function fetchStalePositions(): Promise<StalePosition[]> {
  const { supabase, user } = await getCurrentUser();

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - STALENESS_THRESHOLD_DAYS);

  const { data, error } = await supabase
    .from("positions")
    .select(
      `
      id,
      symbols!inner (
        ticker,
        last_quote_at
      )
    `,
    )
    .eq("user_id", user.id)
    .is("archived_at", null)
    .not("symbol_id", "is", null)
    .or(
      `last_quote_at.is.null,last_quote_at.lt.${thresholdDate.toISOString()}`,
      { referencedTable: "symbols" },
    );

  if (error) {
    console.error("Failed to fetch stale positions:", error);
    return [];
  }

  return (
    data?.flatMap((position) => {
      // Supabase joins can return symbols as either single object or array
      // even with !inner join. Handle both cases defensively.
      const symbol = Array.isArray(position.symbols)
        ? position.symbols[0]
        : position.symbols;

      // Skip positions without valid ticker (defensive check)
      if (!symbol?.ticker) return [];

      return [
        {
          positionId: position.id,
          ticker: symbol.ticker,
        },
      ];
    }) ?? []
  );
}
