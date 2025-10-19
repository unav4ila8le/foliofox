"use server";

import { createClient } from "@/supabase/server";

/**
 * Fetch all supported position categories
 */
export async function fetchPositionCategories(
  positionType: "asset" | "liability" = "asset",
) {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("position_categories")
    .select("id, name")
    .eq("position_type", positionType)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch position categories: ${error.message}`);
  }

  return categories;
}
