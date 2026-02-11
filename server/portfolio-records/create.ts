"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";
import { formatUTCDateKey } from "@/lib/date/date-utils";
import {
  validatePortfolioRecordTimelineWindow,
  validateRecordQuantityByType,
} from "@/server/portfolio-records/timeline-validator";

import type { PortfolioRecord } from "@/types/global.types";

import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

/**
 * Create a new portfolio record for a position.
 * After insertion, recalculate position snapshots starting at the record date
 * until (but excluding) the next UPDATE record.
 */
export async function createPortfolioRecord(formData: FormData) {
  const { supabase, user } = await getCurrentUser();
  const quantity = Number(formData.get("quantity"));

  // Extract portfolio record data
  const portfolioRecordData: Pick<
    PortfolioRecord,
    "position_id" | "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    position_id: formData.get("position_id") as string,
    type: formData.get("type") as (typeof PORTFOLIO_RECORD_TYPES)[number],
    date: formData.get("date") as string,
    quantity,
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Extract custom cost basis if provided (for UPDATE records)
  const customCostBasis = formData.get("cost_basis_per_unit");
  const costBasisPerUnit =
    customCostBasis != null && String(customCostBasis).trim() !== ""
      ? Number(customCostBasis)
      : null;
  const normalizedDate = formatUTCDateKey(portfolioRecordData.date);
  const quantityValidation = validateRecordQuantityByType({
    type: portfolioRecordData.type,
    quantity: portfolioRecordData.quantity,
  });

  if (!quantityValidation.valid) {
    return {
      success: false,
      code: quantityValidation.code,
      message: quantityValidation.message,
    } as const;
  }

  const { data: affectedRecords, error: affectedRecordsError } = await supabase
    .from("portfolio_records")
    .select("id, position_id, type, date, quantity, created_at")
    .eq("user_id", user.id)
    .eq("position_id", portfolioRecordData.position_id)
    .gte("date", normalizedDate);

  if (affectedRecordsError) {
    return {
      success: false,
      code: affectedRecordsError.code ?? "TIMELINE_FETCH_FAILED",
      message:
        affectedRecordsError.message ??
        "Failed to validate portfolio record timeline",
    } as const;
  }

  const timelineValidation = await validatePortfolioRecordTimelineWindow({
    supabase,
    userId: user.id,
    positionId: portfolioRecordData.position_id,
    records: [
      ...(affectedRecords ?? []),
      {
        ...portfolioRecordData,
        date: normalizedDate,
      },
    ],
  });

  if (!timelineValidation.valid) {
    return {
      success: false,
      code: timelineValidation.code,
      message: timelineValidation.message,
    } as const;
  }

  // Insert portfolio record
  const { data: inserted, error: insertError } = await supabase
    .from("portfolio_records")
    .insert({ user_id: user.id, ...portfolioRecordData, date: normalizedDate })
    .select("id, position_id, date")
    .single();

  if (!inserted || insertError) {
    return {
      success: false,
      code: insertError?.code || "UNKNOWN",
      message: insertError?.message || "Failed to create portfolio record",
    } as const;
  }

  const customCostBasisMap =
    portfolioRecordData.type === "update" && costBasisPerUnit !== null
      ? { [inserted.id]: costBasisPerUnit }
      : undefined;

  // Recalculate snapshots from this date forward
  const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: inserted.position_id,
    fromDate: new Date(inserted.date),
    customCostBasisByRecordId: customCostBasisMap,
  });

  if (!recalculationResult.success) {
    return {
      success: false,
      code: "RECALCULATION_FAILED",
      message: "Failed to recalculate snapshots after record creation",
    } as const;
  }

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
