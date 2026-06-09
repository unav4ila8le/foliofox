"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { PositionType, UserPositionCategoryMutationResult } from "./types";
import {
  fetchExistingUserCategoryByName,
  normalizeUserCategoryName,
} from "./utils";

interface UpdateUserPositionCategoryInput {
  id: string;
  name: string;
  positionType?: PositionType;
}

export async function updateUserPositionCategory({
  id,
  name,
  positionType = "asset",
}: UpdateUserPositionCategoryInput): Promise<UserPositionCategoryMutationResult> {
  const { supabase, user } = await getCurrentUser();
  const normalizedName = normalizeUserCategoryName(name);

  if (!normalizedName) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Category name is required.",
    };
  }

  const duplicateCategory = await fetchExistingUserCategoryByName(
    supabase,
    user.id,
    positionType,
    normalizedName,
    { excludeCategoryId: id },
  );
  if (duplicateCategory) {
    return {
      success: false,
      code: "DUPLICATE_NAME",
      message: "A custom category with this name already exists.",
    };
  }

  const { data: category, error } = await supabase
    .from("user_position_categories")
    .update({ name: normalizedName })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("position_type", positionType)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    };
  }

  if (!category) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Custom category not found.",
    };
  }

  revalidatePath("/dashboard", "layout");
  return {
    success: true,
    category,
  };
}
