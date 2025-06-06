"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { Holding } from "@/types/global.types";

// Create type for holding creation by omitting auto-generated fields
type CreateHoldingData = Pick<
  Holding,
  | "name"
  | "category_code"
  | "currency"
  | "current_value"
  | "current_quantity"
  | "description"
>;

// Create holding
export async function createHolding(data: CreateHoldingData) {
  const { supabase, user } = await getCurrentUser();

  // Insert into holdings table
  const { error } = await supabase.from("holdings").insert({
    user_id: user.id,
    ...data,
  });

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
