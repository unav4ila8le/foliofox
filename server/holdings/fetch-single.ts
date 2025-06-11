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

  // Get the most recent record for this holding
  const { data: latestRecord } = await supabase
    .from("records")
    .select("unit_value, quantity")
    .eq("holding_id", holding.id)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current_unit_value = latestRecord?.unit_value || 0;
  const current_quantity = latestRecord?.quantity || 0;

  // Transform the data to include current_unit_value, current_quantity, total_value and asset_type
  const transformedHolding: TransformedHolding = {
    ...holding,
    asset_type: holding.asset_categories.name,
    current_unit_value,
    current_quantity,
    total_value: current_unit_value * current_quantity,
  };

  return transformedHolding;
}
