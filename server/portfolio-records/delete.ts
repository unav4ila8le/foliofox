"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

// Delete a single portfolio record and recalculate snapshots
export async function deletePortfolioRecord(portfolioRecordId: string) {
  const supabase = await createClient();

  // First, get the record to know the position_id and date
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
    };
  }

  // Recalculate snapshots from the record date forward (excluding this record)
  const recalculateResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: record.position_id,
    fromDate: new Date(record.date),
    excludePortfolioRecordId: portfolioRecordId,
  });

  if (!recalculateResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate snapshots after record deletion",
    };
  }

  // Delete the record
  const { error } = await supabase
    .from("portfolio_records")
    .delete()
    .eq("id", portfolioRecordId);

  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Delete multiple portfolio records
export async function deletePortfolioRecords(portfolioRecordIds: string[]) {
  let successCount = 0;
  const errors: string[] = [];

  for (const portfolioRecordId of portfolioRecordIds) {
    const result = await deletePortfolioRecord(portfolioRecordId);
    if (result.success) {
      successCount++;
    } else {
      errors.push(result.message || "Unknown error");
    }
  }

  return {
    success: errors.length === 0,
    count: successCount,
    message: errors.length > 0 ? errors.join(", ") : undefined,
  };
}
