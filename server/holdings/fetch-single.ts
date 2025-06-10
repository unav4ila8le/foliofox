"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { Holding } from "@/types/global.types";

type TransformedHolding = Holding & {
  asset_type: string;
  total_value: number;
};

// Fetch single holding by ID
export async function fetchSingleHolding(holdingId: string) {
  const { supabase, user } = await getCurrentUser();

  const { data: holding, error } = await supabase
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
      is_archived,
      archived_at,
      asset_categories (
        name,
        display_order
      )
    `,
    )
    .eq("id", holdingId)
    .eq("user_id", user.id)
    .single();

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  // Transform the data to include asset_type and total_value
  const transformedHolding: TransformedHolding = {
    ...holding,
    asset_type: holding.asset_categories.name,
    total_value: holding.current_value * holding.current_quantity,
  };

  return transformedHolding;
}
