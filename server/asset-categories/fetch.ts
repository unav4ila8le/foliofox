"use server";

import { createClient } from "@/supabase/server";

/**
 * Fetch all supported asset categories
 */
export async function fetchAssetCategories() {
  const supabase = await createClient();

  const { data: assetCategories, error } = await supabase
    .from("asset_categories")
    .select("code, name")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch asset categories: ${error.message}`);
  }

  return assetCategories;
}
