"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createClient } from "@/supabase/server";

import type {
  PositionCategory,
  UserPositionCategory,
} from "@/types/global.types";

type PositionType = "asset" | "liability";

interface CreateUserPositionCategoryInput {
  name: string;
  positionType?: PositionType;
  description?: string | null;
}

interface FetchPositionCategoriesOptions {
  positionType?: PositionType;
  includeCustomCategories?: boolean;
}

// Normalized category row used by selectors and imports. System and custom
// categories share one shape so the UI can persist selections without branching
// on database table names.
export type PositionCategoryListItem = {
  id: string;
  name: string;
  source: "system" | "custom";
  category_id: string;
  user_category_id: string | null;
  position_type: PositionType;
};

type UserPositionCategoryResult =
  | {
      success: true;
      category: UserPositionCategory;
      created: boolean;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

function normalizeUserCategoryName(name: string) {
  return name.trim();
}

function getUserCategoryLookupKey(name: string) {
  return normalizeUserCategoryName(name).toLocaleLowerCase();
}

async function fetchExistingUserCategoryByName(
  userId: string,
  positionType: PositionType,
  name: string,
): Promise<UserPositionCategory | null> {
  const supabase = await createClient();
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
      (category) => getUserCategoryLookupKey(category.name) === lookupKey,
    ) ?? null
  );
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

export async function createUserPositionCategory({
  name,
  positionType = "asset",
  description = null,
}: CreateUserPositionCategoryInput): Promise<UserPositionCategoryResult> {
  const { supabase, user } = await getCurrentUser();
  const normalizedName = normalizeUserCategoryName(name);

  if (!normalizedName) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Category name is required.",
    };
  }

  const existingCategory = await fetchExistingUserCategoryByName(
    user.id,
    positionType,
    normalizedName,
  );
  if (existingCategory) {
    return {
      success: true,
      category: existingCategory,
      created: false,
    };
  }

  const { data: category, error } = await supabase
    .from("user_position_categories")
    .insert({
      user_id: user.id,
      position_type: positionType,
      name: normalizedName,
      description,
    })
    .select("*")
    .single();

  if (category) {
    revalidatePath("/dashboard", "layout");
    return {
      success: true,
      category,
      created: true,
    };
  }

  if (error?.code === "23505") {
    const duplicateCategory = await fetchExistingUserCategoryByName(
      user.id,
      positionType,
      normalizedName,
    );
    if (duplicateCategory) {
      return {
        success: true,
        category: duplicateCategory,
        created: false,
      };
    }
  }

  return {
    success: false,
    code: error?.code ?? "CUSTOM_CATEGORY_CREATE_FAILED",
    message: error?.message ?? "Failed to create custom category.",
  };
}

export async function resolveUserPositionCategoryByName(
  input: CreateUserPositionCategoryInput,
): Promise<UserPositionCategoryResult> {
  return createUserPositionCategory(input);
}
