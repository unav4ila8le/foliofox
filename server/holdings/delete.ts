"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";

export async function deleteHolding(holding_id: string) {
  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", holding_id);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/assets", "layout");
  return { success: true };
}
