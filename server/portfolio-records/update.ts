"use server";

import { revalidatePath } from "next/cache";

import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";
import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";
import {
  validatePortfolioRecordTimelineWindow,
  validateRecordQuantityByType,
} from "@/server/portfolio-records/validate-timeline";

import type { PortfolioRecord } from "@/types/global.types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";

// Update a single portfolio record and recalculate snapshots for the affected window
export async function updatePortfolioRecord(
  formData: FormData,
  portfolioRecordId: string,
) {
  const { supabase, user } = await getCurrentUser();
  const dateRaw = (formData.get("date") as string) ?? "";
  const parsedDate = parseUTCDateKey(dateRaw);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      success: false,
      code: "INVALID_DATE",
      message: "Invalid date. Use YYYY-MM-DD.",
    } as const;
  }
  const normalizedDate = formatUTCDateKey(parsedDate);

  // Extract incoming data
  const updateData: Pick<
    PortfolioRecord,
    "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    type: formData.get("type") as (typeof PORTFOLIO_RECORD_TYPES)[number],
    date: normalizedDate,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };
  const quantityValidation = validateRecordQuantityByType({
    type: updateData.type,
    quantity: updateData.quantity,
  });

  if (!quantityValidation.valid) {
    return {
      success: false,
      code: quantityValidation.code,
      message: quantityValidation.message,
    } as const;
  }

  const hasCustomCostBasis = formData.has("cost_basis_per_unit");
  const customCostBasisRaw = formData.get("cost_basis_per_unit");
  const costBasisPerUnit =
    customCostBasisRaw != null && String(customCostBasisRaw).trim() !== ""
      ? Number(customCostBasisRaw)
      : null;

  // Fetch current record to get position_id, original date, and created_at
  const { data: current, error: fetchError } = await supabase
    .from("portfolio_records")
    .select("position_id, date, created_at")
    .eq("user_id", user.id)
    .eq("id", portfolioRecordId)
    .single();

  if (fetchError || !current) {
    return {
      success: false,
      code: fetchError?.code || "PORTFOLIO_RECORD_NOT_FOUND",
      message: fetchError?.message || "Portfolio record not found",
    } as const;
  }

  // Determine earliest affected date
  const originalDate = new Date(current.date);
  const newDate = new Date(normalizedDate);
  const fromDate = originalDate < newDate ? originalDate : newDate;
  const fromDateKey = formatUTCDateKey(fromDate);

  const { data: affectedRecords, error: affectedRecordsError } = await supabase
    .from("portfolio_records")
    .select("id, position_id, type, date, quantity, created_at")
    .eq("user_id", user.id)
    .eq("position_id", current.position_id)
    .gte("date", fromDateKey);

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
    positionId: current.position_id,
    records: (affectedRecords ?? []).map((record) =>
      record.id === portfolioRecordId
        ? {
            ...record,
            type: updateData.type,
            date: updateData.date,
            quantity: updateData.quantity,
            created_at: current.created_at,
          }
        : record,
    ),
  });

  if (!timelineValidation.valid) {
    return {
      success: false,
      code: timelineValidation.code,
      message: timelineValidation.message,
    } as const;
  }

  // Update portfolio record
  const { error } = await supabase
    .from("portfolio_records")
    .update(updateData)
    .eq("user_id", user.id)
    .eq("id", portfolioRecordId);

  if (error) {
    return {
      success: false,
      code: error.code,
      message: error.message,
    } as const;
  }

  const customCostBasisMap =
    updateData.type === "update" && hasCustomCostBasis
      ? { [portfolioRecordId]: costBasisPerUnit }
      : undefined;

  // Recalculate snapshots from earliest affected date forward (post-update)
  const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: current.position_id,
    fromDate,
    customCostBasisByRecordId: customCostBasisMap,
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
