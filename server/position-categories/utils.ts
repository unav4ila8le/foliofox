import { createClient } from "@/supabase/server";

import type { UserPositionCategory } from "@/types/global.types";

import type { PositionType } from "./types";

export function normalizeUserCategoryName(name: string) {
  return name.trim();
}

export function getUserCategoryLookupKey(name: string) {
  return normalizeUserCategoryName(name).toLocaleLowerCase();
}

export async function fetchExistingUserCategoryByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  positionType: PositionType,
  name: string,
  options?: { excludeCategoryId?: string },
): Promise<UserPositionCategory | null> {
  const lookupKey = getUserCategoryLookupKey(name);

  const { data: categories, error } = await supabase
    .from("user_position_categories")
    .select("*")
    .eq("user_id", userId)
    .eq("position_type", positionType);

  if (error) {
    throw new Error(`Failed to fetch custom categories: ${error.message}`);
  }

  return (
    categories?.find(
      (category) =>
        category.id !== options?.excludeCategoryId &&
        getUserCategoryLookupKey(category.name) === lookupKey,
    ) ?? null
  );
}
