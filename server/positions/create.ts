"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { createServiceClient } from "@/supabase/service";
import { createSymbol } from "@/server/symbols/create";
import { createPositionSnapshot } from "@/server/position-snapshots/create";

import type { Position } from "@/types/global.types";

// Check for duplicate position name
async function checkDuplicatePositionName(
  positionName: string,
  userId: string,
) {
  const { supabase } = await getCurrentUser();

  const { data, error } = await supabase
    .from("positions")
    .select("id")
    .eq("user_id", userId)
    .eq("name", positionName)
    .is("archived_at", null)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check for duplicate names: ${error.message}`);
  }

  return data && data.length > 0;
}

/**
 * Create a new position (asset/liability), optionally linked to a position source
 * (symbol/domain), and write an initial position snapshot.
 */
export async function createPosition(formData: FormData) {
  const { supabase, user } = await getCurrentUser();
  const serviceRoleClient = await createServiceClient();

  // Required fields
  const name = (formData.get("name") as string) || "";
  const currency = (formData.get("currency") as string) || "";
  const category_id = (formData.get("category_id") as string) || "other";
  const type = (formData.get("type") as Position["type"]) || "asset";
  const description = (formData.get("description") as string) || null;

  if (!name || !currency) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Missing required fields: name, currency",
    } as const;
  }

  // Optional identifiers
  const symbolId = (formData.get("symbol_id") as string) || null;
  const domainId = (formData.get("domain_id") as string) || null;

  // Initial snapshot fields
  const quantityRaw = formData.get("quantity");
  const unitValueRaw = formData.get("unit_value");
  const costBasisRaw = formData.get("cost_basis_per_unit");
  const dateRaw = (formData.get("date") as string) || null;

  const quantity = quantityRaw != null ? Number(quantityRaw) : 0;
  const unit_value = unitValueRaw != null ? Number(unitValueRaw) : 0;
  const cost_basis_per_unit =
    costBasisRaw != null && String(costBasisRaw).trim() !== ""
      ? Number(costBasisRaw)
      : unit_value;
  const snapshotDate = dateRaw ? new Date(dateRaw) : new Date();

  // Duplicate name check (active positions only)
  const isDuplicate = await checkDuplicatePositionName(name, user.id);
  if (isDuplicate) {
    return {
      success: false,
      code: "DUPLICATE_NAME",
      message: `A position with the name "${name}" already exists. Please choose a different name.`,
    } as const;
  }

  // Ensure symbol exists when linking to a symbol source
  if (symbolId) {
    const result = await createSymbol(symbolId);
    if (!result.success) {
      return {
        success: false,
        code: result.code,
        message: result.message,
      } as const;
    }
  }

  // Create position source if symbol or domain provided
  let sourceId: string | null = null;
  if (symbolId || domainId) {
    const sourceType: "symbol" | "domain" = symbolId ? "symbol" : "domain";
    const { data: sourceRow, error: sourceError } = await serviceRoleClient
      .from("position_sources")
      .insert({ type: sourceType })
      .select("id")
      .single();

    if (!sourceRow || sourceError) {
      return {
        success: false,
        code: sourceError?.code || "SOURCE_CREATE_FAILED",
        message: sourceError?.message || "Failed to create position source",
      } as const;
    }

    sourceId = sourceRow.id;

    if (symbolId) {
      const { error: linkError } = await serviceRoleClient
        .from("source_symbols")
        .insert({ id: sourceId, symbol_id: symbolId });
      if (linkError) {
        return {
          success: false,
          code: linkError.code,
          message: linkError.message,
        } as const;
      }
    }

    if (domainId) {
      const { error: linkError } = await serviceRoleClient
        .from("source_domains")
        .insert({ id: sourceId, domain_id: domainId });
      if (linkError) {
        return {
          success: false,
          code: linkError.code,
          message: linkError.message,
        } as const;
      }
    }
  }

  // Create position
  const { data: positionRow, error: positionError } = await supabase
    .from("positions")
    .insert({
      user_id: user.id,
      type,
      name,
      currency,
      category_id,
      description,
      source_id: sourceId,
    })
    .select("id")
    .single();

  if (!positionRow || positionError) {
    return {
      success: false,
      code: positionError?.code || "POSITION_CREATE_FAILED",
      message: positionError?.message || "Failed to create position",
    } as const;
  }

  // Initial snapshot via helper (synthetic)
  const snapshotResult = await createPositionSnapshot({
    position_id: positionRow.id,
    date: format(snapshotDate, "yyyy-MM-dd"),
    quantity,
    unit_value,
    cost_basis_per_unit,
  });

  if (!snapshotResult.success) return snapshotResult;

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
