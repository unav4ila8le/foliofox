"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { Holding, AssetCategory } from "@/types/global.types";

// Fetch holdings
export async function fetchHoldings() {
  const { supabase, user } = await getCurrentUser();

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select(
      `
        id,
        name,
        category_code,
        currency,
        quantity,
        current_value,
        description,
        asset_categories (
          name
        )
      `,
    )
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return holdings as (Holding & { asset_categories: AssetCategory })[];
}
