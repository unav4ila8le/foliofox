"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";
import { formatUTCDateKey } from "@/lib/date/date-utils";

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

  if (!Number.isFinite(quantity)) {
    return {
      success: false,
      code: "INVALID_QUANTITY",
      message: "Quantity must be a valid number.",
    } as const;
  }

  if (
    (portfolioRecordData.type === "buy" ||
      portfolioRecordData.type === "sell") &&
    quantity <= 0
  ) {
    return {
      success: false,
      code: "INVALID_QUANTITY",
      message: `${portfolioRecordData.type === "sell" ? "Sell" : "Buy"} quantity must be greater than 0.`,
    } as const;
  }

  if (portfolioRecordData.type === "update" && quantity < 0) {
    return {
      success: false,
      code: "INVALID_QUANTITY",
      message: "Update quantity must be 0 or greater.",
    } as const;
  }

  // Extract custom cost basis if provided (for UPDATE records)
  const customCostBasis = formData.get("cost_basis_per_unit");
  const costBasisPerUnit =
    customCostBasis != null && String(customCostBasis).trim() !== ""
      ? Number(customCostBasis)
      : null;
  const normalizedDate = formatUTCDateKey(portfolioRecordData.date);

  if (portfolioRecordData.type === "sell") {
    const { data: snapshotAtDate, error: snapshotError } = await supabase
      .from("position_snapshots")
      .select("quantity")
      .eq("user_id", user.id)
      .eq("position_id", portfolioRecordData.position_id)
      .lte("date", normalizedDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      return {
        success: false,
        code: snapshotError.code ?? "SNAPSHOT_FETCH_FAILED",
        message: snapshotError.message ?? "Failed to validate sell quantity",
      } as const;
    }

    const availableQuantity = Number(snapshotAtDate?.quantity ?? 0);
    if (portfolioRecordData.quantity > availableQuantity) {
      return {
        success: false,
        code: "INSUFFICIENT_QUANTITY",
        message: `Cannot sell more than ${availableQuantity} units on ${normalizedDate}.`,
      } as const;
    }
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
