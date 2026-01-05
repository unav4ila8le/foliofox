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
    console.error("Failed to fetch stale position IDs:", error);
    return [];
  }

  return (
    data?.map((position) => ({
      positionId: position.id,
      ticker: position.symbols.ticker,
    })) ?? []
  );
}
