"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";

// Single holding restoration
export async function restoreHolding(holding_id: string) {
  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("holdings")
    .update({
      is_archived: false,
      archived_at: null,
    })
    .eq("id", holding_id);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true };
}

// Multiple holdings restoration
function normalizeIds(ids: string[]): string[] {
  return ids.map((id) => id.trim()).filter(Boolean);
}

export async function restoreHoldings(ids: string[]) {
  const holdingIds = normalizeIds(ids);
  if (holdingIds.length === 0) {
    return { success: false, code: "no_ids", message: "No holdings selected." };
  }

  const { supabase } = await getCurrentUser();

  const { error } = await supabase
    .from("holdings")
    .update({
      is_archived: false,
      archived_at: null,
    })
    .in("id", holdingIds);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true, count: holdingIds.length };
}
