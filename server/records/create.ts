"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { Record } from "@/types/global.types";

// Create record
export async function createRecord(formData: FormData, transactionId?: string) {
  const { supabase, user } = await getCurrentUser();

  // Extract and validate data from formData
  const data: Pick<
    Record,
    "date" | "holding_id" | "quantity" | "unit_value" | "description"
  > = {
    date: formData.get("date") as string,
    holding_id: formData.get("holding_id") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Insert into records table
  const { error } = await supabase.from("records").insert({
    user_id: user.id,
    ...data,
    transaction_id: transactionId || null,
  });

  // Return Supabase errors instead of throwing
  if (error) {
    return {
      success: false,
      code: error?.code || "UNKNOWN",
      message: error?.message || "Failed to create record",
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
