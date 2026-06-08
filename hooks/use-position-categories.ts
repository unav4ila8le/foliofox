"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchPositionCategories } from "@/server/position-categories/fetch";

import type { PositionCategoryListItem } from "@/server/position-categories/fetch";

interface UsePositionCategoriesOptions {
  positionType?: "asset" | "liability";
  // Keep system-only as the default. Custom categories are user-facing labels,
  // while import and AI flows still validate against Foliofox system categories.
  includeCustomCategories?: boolean;
  enabled?: boolean;
}

export function usePositionCategories({
  positionType = "asset",
  includeCustomCategories = false,
  enabled = true,
}: UsePositionCategoriesOptions = {}) {
  const [categories, setCategories] = useState<PositionCategoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Exposed so create flows can refresh the selector after adding a category
  // without duplicating fetch logic in the component.
  const refreshCategories = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPositionCategories({
        positionType,
        includeCustomCategories,
      });
      setCategories(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(new Error(errorMessage));
      console.error("Failed to fetch position categories:", err);
    } finally {
      setIsLoading(false);
    }
  }, [positionType, includeCustomCategories, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;

    async function fetchCategories() {
      try {
        const data = await fetchPositionCategories({
          positionType,
          includeCustomCategories,
        });
        if (!isCurrent) return;
        setCategories(data);
      } catch (err) {
        if (!isCurrent) return;
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(new Error(errorMessage));
        console.error("Failed to fetch position categories:", err);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    fetchCategories();

    return () => {
      isCurrent = false;
    };
  }, [positionType, includeCustomCategories, enabled]);

  return { categories, isLoading, error, refreshCategories };
}
