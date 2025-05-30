"use server";

import { getCurrentUser } from "@/server/auth/actions";
import type { Holding } from "@/types/global.types";

type TransformedHolding = Holding & {
  asset_type: string;
  total_value: number;
};

// Fetch holdings
export async function fetchHoldings(): Promise<TransformedHolding[]> {
  const { supabase, user } = await getCurrentUser();

  const { data: holdings, error } = await supabase
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
    .eq("user_id", user.id)
    .order("asset_categories(display_order)", { ascending: true });

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
