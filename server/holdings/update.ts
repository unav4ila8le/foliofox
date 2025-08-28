"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

import type { Holding } from "@/types/global.types";

export async function updateHolding(formData: FormData, holdingId: string) {
  const supabase = await createClient();

  // Extract and validate data from formData
  const updateData: Pick<Holding, "name" | "category_code" | "description"> = {
    name: formData.get("name") as string,
    category_code: formData.get("category_code") as string,
    description: (formData.get("description") as string) || null,
  };

  // Update the holding in the database
  const { error } = await supabase
    .from("holdings")
    .update(updateData)
    .eq("id", holdingId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
