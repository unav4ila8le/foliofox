"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

import type { AssetCategory } from "@/types/global.types";

export function useAssetCategories() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAssetCategories() {
      // Supabase client
      const supabase = createClient();

      // Get asset categories
      const { data, error } = await supabase
        .from("asset_categories")
        .select("*")
        .order("display_order", { ascending: true });

      // Throw error
      if (error) {
        throw new Error("Error fetching asset categories:", error);
      }

      setCategories(data);
      setIsLoading(false);
    }

    fetchAssetCategories();
  }, []);

  return { categories, isLoading };
}
