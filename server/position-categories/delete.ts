"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { PositionType, UserPositionCategoryDeleteResult } from "./types";

interface DeleteUserPositionCategoryInput {
  id: string;
  positionType?: PositionType;
}

export async function deleteUserPositionCategory({
  id,
  positionType = "asset",
}: DeleteUserPositionCategoryInput): Promise<UserPositionCategoryDeleteResult> {
  const { supabase, user } = await getCurrentUser();

  const { data: category, error: fetchError } = await supabase
    .from("user_position_categories")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("position_type", positionType)
    .maybeSingle();

  if (fetchError) {
    return {
      success: false,
      code: fetchError.code,
      message: fetchError.message,
    };
  }

  if (!category) {
    return {
      success: false,
      code: "NOT_FOUND",
      message: "Custom category not found.",
    };
  }

  // Deleting the category clears positions.user_category_id via ON DELETE SET
  // NULL. Those positions keep category_id = "other" and fall back to the
  // system "Others" label in user-facing views.
  const { error } = await supabase
    .from("user_position_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("position_type", positionType);

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
