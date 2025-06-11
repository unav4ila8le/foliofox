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

  // Transform the data to include asset_type and total_value
  const transformedHoldings: TransformedHolding[] = holdings.map((holding) => ({
    ...holding,
    asset_type: holding.asset_categories.name,
    total_value: holding.current_unit_value * holding.current_quantity,
  }));

  return transformedHoldings;
}
