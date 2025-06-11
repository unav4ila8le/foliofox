"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { TransformedHolding } from "@/types/global.types";

interface FetchHoldingsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

// Fetch holdings with optional filtering for archived holdings
export async function fetchHoldings(options: FetchHoldingsOptions = {}) {
  const { includeArchived = false, onlyArchived = false } = options;

  const { supabase, user } = await getCurrentUser();

  const query = supabase
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
    .eq("user_id", user.id);

  // Handle archived holdings filtering
  if (onlyArchived) {
    query.eq("is_archived", true);
  } else if (!includeArchived) {
    query.eq("is_archived", false);
  }

  const { data: holdings, error } = await query.order(
    "asset_categories(display_order)",
    { ascending: true },
  );

  if (error) {
    throw new Error(error.message);
  }

  // Transform the data by fetching latest records and include asset_type, current_unit_value, current_quantity, and total_value
  const transformedHoldings: TransformedHolding[] = await Promise.all(
    holdings.map(async (holding) => {
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

      return {
        ...holding,
        asset_type: holding.asset_categories.name,
        current_unit_value,
        current_quantity,
        total_value: current_unit_value * current_quantity,
      };
    }),
  );

  return transformedHoldings;
}
