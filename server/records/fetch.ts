"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { TransformedRecord } from "@/types/global.types";

/**
 * Fetch records for a specific holding
 *
 * @param holdingId - The ID of the holding to fetch records for
 * @returns An array of transformed records
 */
export async function fetchRecords(holdingId: string) {
  const { supabase, user } = await getCurrentUser();

  const { data: records, error } = await supabase
    .from("records")
    .select("*")
    .eq("holding_id", holdingId)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
  }

  // Transform records to include total value
  const transformedRecords: TransformedRecord[] = records.map((record) => ({
    ...record,
    total_value: record.quantity * record.unit_value,
  }));

  return transformedRecords;
}
