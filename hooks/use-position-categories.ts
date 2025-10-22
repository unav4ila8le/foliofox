"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/supabase/client";

import type { PositionCategory } from "@/types/global.types";

export function usePositionCategories(
  positionType: "asset" | "liability" = "asset",
) {
  const [categories, setCategories] = useState<PositionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPositionCategories() {
      // Supabase client
      const supabase = createClient();

      // Get position categories
      const { data, error } = await supabase
        .from("position_categories")
        .select("*")
        .eq("position_type", positionType)
        .order("display_order", { ascending: true });

      // Throw error
      if (error) {
        throw new Error("Error fetching position categories:", error);
      }

      setCategories(data);
      setIsLoading(false);
    }

    fetchPositionCategories();
  }, [positionType]);

  return { categories, isLoading };
}
