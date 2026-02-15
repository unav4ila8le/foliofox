"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { resolveSymbolInput } from "@/server/symbols/resolve";
import { createPositionSnapshot } from "@/server/position-snapshots/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { formatUTCDateKey } from "@/lib/date/date-utils";

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
  const rawSymbolInput = (
    (formData.get("symbolLookup") as string) ??
    (formData.get("symbol_id") as string) ??
    ""
  ).trim();
  let symbolUuid: string | null = null;
  const domainId = (formData.get("domain_id") as string) || null;

  // Initial snapshot fields
  const quantityRaw = formData.get("quantity");
  const unitValueRaw = formData.get("unit_value");
  const costBasisRaw = formData.get("cost_basis_per_unit");
  const capitalGainsTaxRaw = formData.get("capital_gains_tax_rate");
  const dateRaw = (formData.get("date") as string) || null;

  const quantity = quantityRaw != null ? Number(quantityRaw) : 0;
  let unit_value: number | null =
    unitValueRaw != null && String(unitValueRaw).trim() !== ""
      ? Number(unitValueRaw)
      : null;
  const costBasisInput =
    costBasisRaw != null && String(costBasisRaw).trim() !== ""
      ? Number(costBasisRaw)
      : null;
  const capitalGainsTaxRate =
    capitalGainsTaxRaw != null && String(capitalGainsTaxRaw).trim() !== ""
      ? Number(capitalGainsTaxRaw)
      : null;
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

  // Ensure symbol exists if provided
  if (rawSymbolInput) {
    const resolved = await resolveSymbolInput(rawSymbolInput);

    if (resolved?.symbol?.id) {
      symbolUuid = resolved.symbol.id;
    } else {
      const creationResult = await createSymbol(rawSymbolInput);
      if (!creationResult.success || !creationResult.data?.id) {
        return {
          success: false,
          code: creationResult.code ?? "SYMBOL_CREATE_FAILED",
          message:
            creationResult.message ??
            "Unable to create symbol from provided identifier",
        } as const;
      }

      const postCreateResolved = await resolveSymbolInput(rawSymbolInput);
      if (!postCreateResolved?.symbol?.id) {
        return {
          success: false,
          code: "SYMBOL_RESOLUTION_FAILED",
          message:
            "Symbol metadata was created but could not be resolved to a canonical identifier.",
        } as const;
      }

      symbolUuid = postCreateResolved.symbol.id;
    }

    if (symbolUuid && (unit_value == null || Number.isNaN(unit_value))) {
      try {
        unit_value = await fetchSingleQuote(symbolUuid, {
          upsert: true,
        });
      } catch (error) {
        console.warn(
          `Failed to fetch canonical price for symbol ${symbolUuid}:`,
          error,
        );
        unit_value = null;
      }
    }
  }

  const finalUnitValue =
    unit_value != null && Number.isFinite(unit_value) ? unit_value : 0;
  const finalCostBasis =
    costBasisInput != null && Number.isFinite(costBasisInput)
      ? costBasisInput
      : finalUnitValue;

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
      symbol_id: symbolUuid,
      domain_id: domainId,
      capital_gains_tax_rate: capitalGainsTaxRate,
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
    date: formatUTCDateKey(snapshotDate),
    quantity,
    unit_value: finalUnitValue,
    cost_basis_per_unit: finalCostBasis,
  });

  if (!snapshotResult.success) return snapshotResult;

  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
