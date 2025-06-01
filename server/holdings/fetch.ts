"use server";

import { getCurrentUser } from "@/server/auth/actions";
import type { Holding } from "@/types/global.types";

interface FetchHoldingsOptions {
  includeArchived?: boolean;
}

type TransformedHolding = Holding & {
  asset_type: string;
  total_value: number;
};

// Fetch holdings
export async function fetchHoldings(
  options: FetchHoldingsOptions = {},
): Promise<TransformedHolding[]> {
  const { includeArchived = false } = options;

  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("holdings")
    .select(
      `
      id,
      name,
      category_code,
      currency,
      current_quantity,
      current_value,
      description,
      asset_categories (
        name,
        display_order
      )
    `,
    )
    .eq("user_id", user.id);

  // Include archived holdings if needed
  if (!includeArchived) {
    query.eq("is_archived", false);
  }

  const { data: holdings, error } = await query.order(
    "asset_categories(display_order)",
    { ascending: true },
  );

  if (error) {
    throw new Error(error.message);
  }

  // Transform the data to include asset_type and total_value
  const transformedHoldings = holdings.map((holding) => ({
    ...holding,
    asset_type: holding.asset_categories.name,
    total_value: holding.current_value * holding.current_quantity,
  }));

  return transformedHoldings;
}
