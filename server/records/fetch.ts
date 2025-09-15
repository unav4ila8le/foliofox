"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { TransformedRecord } from "@/types/global.types";

interface FetchRecordsParams {
  holdingId: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Fetch records for a specific holding with optional date range filters
 *
 * @param options - Optional filtering options
 * @returns An array of transformed records
 */
export async function fetchRecords(options: FetchRecordsParams) {
  const { holdingId, startDate, endDate } = options;
  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("records")
    .select(
      `
      *,
      holdings!inner (
        currency,
        is_archived
      )
    `,
    )
    .eq("holding_id", holdingId)
    .eq("user_id", user.id);

  // Add inclusivedate range filters if provided
  if (startDate) query.gte("date", startDate.toISOString().slice(0, 10));
  if (endDate) query.lte("date", endDate.toISOString().slice(0, 10));

  const { data: records, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
  }

  // Transform records to include total value
  const transformedRecords: TransformedRecord[] = records.map((record) => ({
    ...record,
    total_value: record.quantity * record.unit_value,
    currency: record.holdings?.currency as string,
  }));

  return transformedRecords;
}
