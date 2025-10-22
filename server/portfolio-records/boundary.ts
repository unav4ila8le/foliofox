"use server";

import { getCurrentUser } from "@/server/auth/actions";

/**
 * Fetch the boundary date for a portfolio record.
 * The boundary date is the earliest date between the first update and the first snapshot.
 * @param positionId - The ID of the position to fetch the boundary date for.
 * @returns The boundary date or null if no boundary date is found.
 */
export async function fetchRecordBoundaryDate(
  positionId: string,
): Promise<string | null> {
  const { supabase, user } = await getCurrentUser();

  const { data: firstUpdate } = await supabase
    .from("portfolio_records")
    .select("date")
    .eq("user_id", user.id)
    .eq("position_id", positionId)
    .eq("type", "update")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: firstSnapshot } = await supabase
    .from("position_snapshots")
    .select("date")
    .eq("user_id", user.id)
    .eq("position_id", positionId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const boundary =
    firstUpdate?.date && firstSnapshot?.date
      ? firstUpdate.date < firstSnapshot.date
        ? firstUpdate.date
        : firstSnapshot.date
      : (firstUpdate?.date ?? firstSnapshot?.date ?? null);

  return boundary ?? null;
}
