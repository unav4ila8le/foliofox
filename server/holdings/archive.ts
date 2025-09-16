"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";

// Single holding archiving
export async function archiveHolding(holdingId: string) {
  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("holdings")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", holdingId);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true };
}

// Multiple holdings archiving
export async function archiveHoldings(holdingIds: string[]) {
  if (holdingIds.length === 0) {
    return { success: false, code: "no_ids", message: "No holdings selected." };
  }

  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("holdings")
    .update({
      archived_at: new Date().toISOString(),
    })
    .in("id", holdingIds);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true, count: holdingIds.length };
}
