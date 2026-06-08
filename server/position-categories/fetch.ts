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

export type PositionCategoryOption = {
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

async function resolveNextUserCategoryDisplayOrder(
  userId: string,
  positionType: PositionType,
) {
  const supabase = await createClient();

  const { data: latestCategory, error } = await supabase
    .from("user_position_categories")
    .select("display_order")
    .eq("user_id", userId)
    .eq("position_type", positionType)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to resolve custom category order: ${error.message}`,
    );
  }

  return (latestCategory?.display_order ?? -1) + 1;
}

/**
 * Fetch all supported position categories
 */
export async function fetchPositionCategories(
  positionType: PositionType = "asset",
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

export async function fetchCombinedPositionCategories(
  positionType: PositionType = "asset",
): Promise<PositionCategoryOption[]> {
  const supabase = await createClient();

  const [systemResult, customResult] = await Promise.all([
    supabase
      .from("position_categories")
      .select("id, name, position_type")
      .eq("position_type", positionType)
      .order("display_order", { ascending: true }),
    supabase
      .from("user_position_categories")
      .select("id, name, position_type")
      .eq("position_type", positionType)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (systemResult.error) {
    throw new Error(
      `Failed to fetch position categories: ${systemResult.error.message}`,
    );
  }

  if (customResult.error) {
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

  const customCategories = (customResult.data ?? []).map(
    (
      category: Pick<UserPositionCategory, "id" | "name" | "position_type">,
    ) => ({
      id: category.id,
      name: category.name,
      source: "custom" as const,
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

  const displayOrder = await resolveNextUserCategoryDisplayOrder(
    user.id,
    positionType,
  );

  const { data: category, error } = await supabase
    .from("user_position_categories")
    .insert({
      user_id: user.id,
      position_type: positionType,
      name: normalizedName,
      description,
      display_order: displayOrder,
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
