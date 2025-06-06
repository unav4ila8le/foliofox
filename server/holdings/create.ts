"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { Holding } from "@/types/global.types";

// Create holding
export async function createHolding(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Holding,
    | "name"
    | "category_code"
    | "currency"
    | "current_value"
    | "current_quantity"
    | "description"
  > = {
    name: formData.get("name") as string,
    category_code: formData.get("category_code") as string,
    currency: formData.get("currency") as string,
    current_value: Number(formData.get("current_value")),
    current_quantity: Number(formData.get("current_quantity")),
    description: formData.get("description") as string | null,
  };

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
