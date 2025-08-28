"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

import type { Transaction } from "@/types/global.types";

// Update a single transaction
export async function updateTransaction(
  formData: FormData,
  transactionId: string,
) {
  const supabase = await createClient();

  // Extract and validate data from formData
  const updateData: Pick<
    Transaction,
    "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    type: formData.get("type") as "buy" | "sell" | "update",
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Update the transaction in the database
  const { error } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", transactionId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
