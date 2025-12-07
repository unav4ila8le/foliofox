"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/supabase/client";

import type { PositionCategory } from "@/types/global.types";

export function usePositionCategories(
  positionType: "asset" | "liability" = "asset",
) {
  const [categories, setCategories] = useState<PositionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPositionCategories() {
      try {
        // Supabase client
        const supabase = createClient();

        // Get position categories
        const { data, error: supabaseError } = await supabase
          .from("position_categories")
          .select("*")
          .eq("position_type", positionType)
          .order("display_order", { ascending: true });

        // Handle error
        if (supabaseError) {
          throw new Error(
            `Error fetching position categories: ${supabaseError.message}`,
          );
        }

        setCategories(data || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(new Error(errorMessage));
        console.error("Failed to fetch position categories:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPositionCategories();
  }, [positionType]);

  return { categories, isLoading, error };
}
