"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

// Delete a single transaction (no cascade yet)
export async function deleteTransaction(transactionId: string) {
  const { supabase, user } = await getCurrentUser();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
