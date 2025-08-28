"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";

// Single record deletion
export async function deleteRecord(recordId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("records").delete().eq("id", recordId);

  // Return errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true };
}

// Multiple record deletion
export async function deleteRecords(recordIds: string[]) {
  if (recordIds.length === 0) {
    return { success: false, code: "no_ids", message: "No records selected." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("records").delete().in("id", recordIds);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard/holdings", "layout");
  return { success: true, count: recordIds.length };
}
