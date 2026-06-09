"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { createClient } from "@/supabase/server";

import type {
  PositionCategory,
  UserPositionCategory,
} from "@/types/global.types";

import type {
  PositionCategoryListItem,
  PositionType,
  UserPositionCategoryListItem,
} from "./types";

interface FetchPositionCategoriesOptions {
  positionType?: PositionType;
  includeCustomCategories?: boolean;
}

interface FetchUserPositionCategoriesWithUsageOptions {
  positionType?: PositionType;
}

/**
 * Fetch position categories for UI and import flows.
 *
 * By default this returns only Foliofox system categories. Custom categories are
 * opt-in because import and AI flows still need the canonical system taxonomy.
 */
export async function fetchPositionCategories({
  positionType = "asset",
  includeCustomCategories = false,
}: FetchPositionCategoriesOptions = {}): Promise<PositionCategoryListItem[]> {
  const supabase = await createClient();

  const systemQuery = supabase
    .from("position_categories")
    .select("id, name, position_type")
    .eq("position_type", positionType)
    .order("display_order", { ascending: true });

  const customQuery = includeCustomCategories
    ? supabase
        .from("user_position_categories")
        .select("id, name, position_type")
        .eq("position_type", positionType)
        .order("name", { ascending: true })
    : null;

  const [systemResult, customResult] = await Promise.all([
    systemQuery,
    customQuery,
  ]);

  if (systemResult.error) {
    throw new Error(
      `Failed to fetch position categories: ${systemResult.error.message}`,
    );
  }

  if (customResult?.error) {
    throw new Error(
      `Failed to fetch custom position categories: ${customResult.error.message}`,
    );
  }

  const systemCategories = (systemResult.data ?? []).map(
    (category: Pick<PositionCategory, "id" | "name" | "position_type">) => ({
      id: category.id,
      name: category.name,
      source: "system" as const,
      category_id: category.id,
      user_category_id: null,
      position_type: category.position_type,
    }),
  );

  const customCategories = (customResult?.data ?? []).map(
    (
      category: Pick<UserPositionCategory, "id" | "name" | "position_type">,
    ) => ({
      id: category.id,
      name: category.name,
      source: "custom" as const,
      // Custom categories intentionally opt out of the Foliofox taxonomy.
      // "other" satisfies the required system category while user_category_id
      // drives the visible label and user-facing grouping.
      category_id: "other",
      user_category_id: category.id,
      position_type: category.position_type,
    }),
  );

  return [...systemCategories, ...customCategories];
}

export async function fetchUserPositionCategoriesWithUsage({
  positionType = "asset",
}: FetchUserPositionCategoriesWithUsageOptions = {}): Promise<
  UserPositionCategoryListItem[]
> {
  const { supabase, user } = await getCurrentUser();

  const [categoriesResult, positionsResult] = await Promise.all([
    supabase
      .from("user_position_categories")
      .select("id, name, position_type")
      .eq("user_id", user.id)
      .eq("position_type", positionType)
      .order("name", { ascending: true }),
    supabase
      .from("positions")
      .select("user_category_id")
      .eq("user_id", user.id)
      .eq("type", positionType)
      .not("user_category_id", "is", null),
  ]);

  if (categoriesResult.error) {
    throw new Error(
      `Failed to fetch custom position categories: ${categoriesResult.error.message}`,
    );
  }

  if (positionsResult.error) {
    throw new Error(
      `Failed to fetch position category usage: ${positionsResult.error.message}`,
    );
  }

  const positionCountByCategoryId = new Map<string, number>();
  for (const position of positionsResult.data ?? []) {
    if (!position.user_category_id) {
      continue;
    }

    positionCountByCategoryId.set(
      position.user_category_id,
      (positionCountByCategoryId.get(position.user_category_id) ?? 0) + 1,
    );
  }

  return (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    position_type: category.position_type,
    position_count: positionCountByCategoryId.get(category.id) ?? 0,
  }));
}
