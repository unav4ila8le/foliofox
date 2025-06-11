"use server";

import { notFound } from "next/navigation";

import { getCurrentUser } from "@/server/auth/actions";

import type { TransformedHolding } from "@/types/global.types";

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
      current_unit_value,
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

  if (error) {
    if (error.code === "PGRST116") {
      notFound();
    }
    throw new Error(error.message);
  }

  // Transform the data to include asset_type and total_value
  const transformedHolding: TransformedHolding = {
    ...holding,
    asset_type: holding.asset_categories.name,
    total_value: holding.current_unit_value * holding.current_quantity,
  };

  return transformedHolding;
}
