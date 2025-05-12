"use server";

import { createClient } from "@/utils/supabase/server";

import type { AssetCategory } from "@/types/global.types";

export async function fetchAssetCategories(): Promise<AssetCategory[]> {
  // Supabase client
  const supabase = await createClient();

  // Get asset categories
  const { data: assetCategories, error } = await supabase
    .from("asset_categories")
    .select("*")
    .order("display_order", { ascending: true });

  // Throw error
  if (error) {
    throw new Error(error.message);
  }

  return assetCategories;
}
