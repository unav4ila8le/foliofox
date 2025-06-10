"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { Record } from "@/types/global.types";

export async function updateRecord(formData: FormData, recordId: string) {
  const { supabase } = await getCurrentUser();

  // Extract and validate data from formData
  const updateData: Pick<
    Record,
    "date" | "quantity" | "value" | "description"
  > = {
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    value: Number(formData.get("value")),
    description: (formData.get("description") as string) || "",
  };

  // Update the record in the database
  const { error } = await supabase
    .from("records")
    .update(updateData)
    .eq("id", recordId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
