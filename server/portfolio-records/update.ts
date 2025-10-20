"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

import type { PortfolioRecord } from "@/types/global.types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

// Update a single portfolio record and recalculate snapshots for the affected window
export async function updatePortfolioRecord(
  formData: FormData,
  portfolioRecordId: string,
) {
  const supabase = await createClient();

  // Extract incoming data
  const updateData: Pick<
    PortfolioRecord,
    "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    type: formData.get("type") as (typeof PORTFOLIO_RECORD_TYPES)[number],
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Fetch current record to get position_id and original date
  const { data: current, error: fetchError } = await supabase
    .from("portfolio_records")
    .select("position_id, date")
    .eq("id", portfolioRecordId)
    .single();

  if (fetchError || !current) {
    return {
      success: false,
      code: fetchError?.code || "PORTFOLIO_RECORD_NOT_FOUND",
      message: fetchError?.message || "Portfolio record not found",
    } as const;
  }

  // Update portfolio record
  const { error } = await supabase
    .from("portfolio_records")
    .update(updateData)
    .eq("id", portfolioRecordId);

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;
  }

  // Determine earliest affected date
  const originalDate = new Date(current.date);
  const newDate = new Date(updateData.date);
  const fromDate = originalDate < newDate ? originalDate : newDate;

  // Recalculate snapshots from earliest affected date forward (post-update)
  const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: current.position_id,
    fromDate,
  });

  if (!recalculationResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate snapshots after record update",
    } as const;
  }

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
