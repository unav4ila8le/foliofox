"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import { createRecord } from "@/server/records/create";

import type { Holding } from "@/types/global.types";

// Create holding
export async function createHolding(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Holding,
    "name" | "category_code" | "currency" | "description"
  > = {
    name: formData.get("name") as string,
    category_code: formData.get("category_code") as string,
    currency: formData.get("currency") as string,
    description: (formData.get("description") as string) || "",
  };

  // Extract current quantity and unit value separately (for the initial record)
  const current_quantity = Number(formData.get("current_quantity"));
  const current_unit_value = Number(formData.get("current_unit_value"));

  // Insert into holdings table
  const { data: holding, error: holdingError } = await supabase
    .from("holdings")
    .insert({
      user_id: user.id,
      ...data,
    })
    .select("id")
    .single();

  // Return Supabase errors instead of throwing
  if (!holding || holdingError) {
    return {
      success: false,
      code: holdingError?.code || "UNKNOWN",
      message: holdingError?.message || "Failed to create holding",
    };
  }

  // Create initial record using the existing createRecord function (convert to formData first)
  const recordFormData = new FormData();
  recordFormData.append("holding_id", holding.id);
  recordFormData.append("date", new Date().toISOString());
  recordFormData.append("quantity", current_quantity.toString());
  recordFormData.append("unit_value", current_unit_value.toString());
  recordFormData.append("description", "Initial holding creation");

  const recordResult = await createRecord(recordFormData);

  if (!recordResult.success) {
    return {
      success: false,
      code: recordResult.code,
      message: recordResult.message,
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
