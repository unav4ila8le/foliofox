"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

// Delete a single portfolio record and recalculate snapshots
export async function deletePortfolioRecord(portfolioRecordId: string) {
  const supabase = await createClient();

  // Get the record to know position and date
  const { data: record, error: fetchError } = await supabase
    .from("portfolio_records")
    .select("position_id, date")
    .eq("id", portfolioRecordId)
    .single();

  if (fetchError || !record) {
    return {
      success: false,
      code: fetchError?.code || "PORTFOLIO_RECORD_NOT_FOUND",
      message: fetchError?.message || "Portfolio record not found",
    } as const;
  }

  // Delete the record
  const { error } = await supabase
    .from("portfolio_records")
    .delete()
    .eq("id", portfolioRecordId);

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;
  }

  // Recalculate snapshots from this date forward (post-deletion)
  const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: record.position_id,
    fromDate: new Date(record.date),
  });

  if (!recalculationResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate snapshots after record deletion",
    } as const;
  }

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}

// Delete multiple portfolio records and recalculate snapshots per position
export async function deletePortfolioRecords(portfolioRecordIds: string[]) {
  if (!portfolioRecordIds.length) {
    return {
      success: false,
      code: "no_ids",
      message: "No records selected.",
    } as const;
  }

  const supabase = await createClient();

  // Fetch positions and dates for all records to determine recalculation windows per position
  const { data: records, error: fetchError } = await supabase
    .from("portfolio_records")
    .select("id, position_id, date")
    .in("id", portfolioRecordIds);

  if (fetchError || !records?.length) {
    return {
      success: false,
      code: fetchError?.code || "PORTFOLIO_RECORDS_NOT_FOUND",
      message: fetchError?.message || "Portfolio records not found",
    } as const;
  }

  // Perform deletion
  const { error: deleteError } = await supabase
    .from("portfolio_records")
    .delete()
    .in("id", portfolioRecordIds);

  if (deleteError) {
    return {
      success: false,
      code: deleteError.code,
      message: deleteError.message,
    } as const;
  }

  // Group recalculation per position, from the earliest affected date
  const byPosition = new Map<string, string[]>();
  const minDateByPosition = new Map<string, string>();
  for (const r of records) {
    if (!byPosition.has(r.position_id)) byPosition.set(r.position_id, []);
    byPosition.get(r.position_id)!.push(r.id);
    const prev = minDateByPosition.get(r.position_id);
    if (!prev || r.date < prev) minDateByPosition.set(r.position_id, r.date);
  }

  for (const [positionId] of byPosition.entries()) {
    const fromDateStr = minDateByPosition.get(positionId)!;
    await recalculateSnapshotsUntilNextUpdate({
      positionId,
      fromDate: new Date(fromDateStr),
    });
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, count: portfolioRecordIds.length } as const;
}
