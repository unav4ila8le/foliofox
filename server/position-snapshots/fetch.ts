"use server";

import { getCurrentUser } from "@/server/auth/actions";

import type { TransformedPositionSnapshot } from "@/types/global.types";

interface FetchPositionSnapshotsParams {
  positionId: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Fetch records for a specific holding with optional date range filters
 *
 * @param options - Optional filtering options
 * @returns An array of transformed records
 */
export async function fetchPositionSnapshots(
  options: FetchPositionSnapshotsParams,
) {
  const { positionId, startDate, endDate } = options;
  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("position_snapshots")
    .select(
      `
      *,
      positions!inner (
        currency
      )
    `,
    )
    .eq("position_id", positionId)
    .eq("user_id", user.id);

  // Add inclusivedate range filters if provided
  if (startDate) query.gte("date", startDate.toISOString().slice(0, 10));
  if (endDate) query.lte("date", endDate.toISOString().slice(0, 10));

  const { data: snapshots, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch position snapshots: ${error.message}`);
  }

  // Transform records to include total value
  const transformedSnapshots: TransformedPositionSnapshot[] = snapshots.map(
    (snapshot) => ({
      ...snapshot,
      total_value: snapshot.quantity * snapshot.unit_value,
      currency: snapshot.positions?.currency as string,
    }),
  );

  return transformedSnapshots;
}
