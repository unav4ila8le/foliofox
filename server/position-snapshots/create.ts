"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";

import type { TablesInsert } from "@/types/database.types";

type CreatePositionSnapshotParams = Omit<
  TablesInsert<"position_snapshots">,
  "id" | "user_id" | "created_at"
> & {
  date: string | Date;
};

/**
 * Create a position snapshot.
 * Enforces user ownership and normalizes date; optional portfolio_record_id.
 */
export async function createPositionSnapshot(
  params: CreatePositionSnapshotParams,
) {
  const { supabase, user } = await getCurrentUser();

  const normalizedDate = format(new Date(params.date), "yyyy-MM-dd");

  const { error } = await supabase.from("position_snapshots").insert({
    user_id: user.id,
    position_id: params.position_id,
    date: normalizedDate,
    quantity: params.quantity,
    unit_value: params.unit_value,
    cost_basis_per_unit: params.cost_basis_per_unit ?? null,
    portfolio_record_id: params.portfolio_record_id ?? null,
  });

  if (error) {
    return {
      success: false,
      code: error.code ?? "UNKNOWN",
      message: error.message ?? "Failed to create position snapshot",
    } as const;
  }

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
