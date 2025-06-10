"use server";

import { getCurrentUser } from "@/server/auth/actions";

// Fetch records for a specific holding
export async function fetchRecords(holdingId: string) {
  const { supabase, user } = await getCurrentUser();

  const { data: records, error } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return records || [];
}
