"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

import type { PortfolioRecord } from "@/types/global.types";

/**
 * Create a new portfolio record for a position.
 * After insertion, recalculate position snapshots starting at the record date
 * until (but excluding) the next UPDATE record.
 */
export async function createPortfolioRecord(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Extract record data
  const recordData: Pick<
    PortfolioRecord,
    "position_id" | "type" | "date" | "quantity" | "unit_value" | "description"
  > = {
    position_id: formData.get("position_id") as string,
    type: formData.get("type") as "buy" | "sell" | "update",
    date: formData.get("date") as string,
    quantity: Number(formData.get("quantity")),
    unit_value: Number(formData.get("unit_value")),
    description: (formData.get("description") as string) || null,
  };

  // Insert portfolio record
  const { data: inserted, error: insertError } = await supabase
    .from("portfolio_records")
    .insert({ user_id: user.id, ...recordData })
    .select("id, position_id, date")
    .single();

  if (!inserted || insertError) {
    return {
      success: false,
      code: insertError?.code || "UNKNOWN",
      message: insertError?.message || "Failed to create portfolio record",
    } as const;
  }

  // Recalculate snapshots from this date forward
  const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
    positionId: inserted.position_id,
    fromDate: new Date(inserted.date),
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
