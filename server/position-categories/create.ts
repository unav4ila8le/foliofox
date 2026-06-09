"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { PositionType, UserPositionCategoryCreateResult } from "./types";
import {
  fetchExistingUserCategoryByName,
  normalizeUserCategoryName,
} from "./utils";

interface CreateUserPositionCategoryInput {
  name: string;
  positionType?: PositionType;
  description?: string | null;
}

export async function createUserPositionCategory({
  name,
  positionType = "asset",
  description = null,
}: CreateUserPositionCategoryInput): Promise<UserPositionCategoryCreateResult> {
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
    supabase,
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
      supabase,
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
