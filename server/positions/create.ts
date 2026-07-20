"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { resolveSymbolInput } from "@/server/symbols/resolve";
import { createPositionSnapshot } from "@/server/position-snapshots/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { resolvePositionCategorySelection } from "@/server/positions/category-selection";
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
  let currency = (formData.get("currency") as string) || "";
  const categorySelection = resolvePositionCategorySelection(formData);
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

  // Optional idempotency key (AI-approved writes): a retried approval
  // continuation re-sends the same key; the replay paths below turn the
  // duplicate create into a success for the already-committed position.
  const idempotencyKeyRaw = formData.get("idempotency_key");
  const idempotencyKey =
    idempotencyKeyRaw != null && String(idempotencyKeyRaw).trim() !== ""
      ? String(idempotencyKeyRaw)
      : null;

  // Initial snapshot fields
  const quantityRaw = formData.get("quantity");
  const unitValueRaw = formData.get("unit_value");
  const costBasisRaw = formData.get("cost_basis_per_unit");
  const capitalGainsTaxRaw = formData.get("capital_gains_tax_rate");
  const dateRaw = (formData.get("date") as string) || null;

  const quantity = quantityRaw != null ? Number(quantityRaw) : 0;
  const unit_value: number | null =
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

  async function fetchCommittedPositionByIdempotencyKey(key: string) {
    const { data: existingByKey } = await supabase
      .from("positions")
      .select("id, symbol_id")
      .eq("user_id", user.id)
      .eq("idempotency_key", key)
      .maybeSingle();

    return existingByKey ?? null;
  }

  // Initial-snapshot + cache-revalidation tail shared by the fresh-insert
  // path and the replay paths: the first attempt may have died between the
  // position insert and the snapshot write, so a replay re-creates a missing
  // snapshot (it is skipped when one already exists) instead of reporting
  // success over a half-created position.
  async function finalizePosition(position: {
    id: string;
    symbol_id: string | null;
  }) {
    const { data: existingSnapshot } = await supabase
      .from("position_snapshots")
      .select("id")
      .eq("position_id", position.id)
      .limit(1)
      .maybeSingle();

    if (existingSnapshot) {
      revalidatePath("/dashboard", "layout");
      return { success: true } as const;
    }

    let resolvedUnitValue = unit_value;
    if (
      position.symbol_id &&
      (resolvedUnitValue == null || Number.isNaN(resolvedUnitValue))
    ) {
      try {
        // Avoid seeding cooldown during create so the immediate dashboard render
        // can retry live quote repair if this bootstrap read returns no data.
        resolvedUnitValue = await fetchSingleQuote(position.symbol_id, {
          upsert: true,
          liveMissCooldownMinutes: 0,
        });
      } catch (error) {
        console.warn(
          `Failed to fetch canonical price for symbol ${position.symbol_id}:`,
          error,
        );
        resolvedUnitValue = null;
      }
    }

    const finalUnitValue =
      resolvedUnitValue != null && Number.isFinite(resolvedUnitValue)
        ? resolvedUnitValue
        : 0;
    const finalCostBasis =
      costBasisInput != null && Number.isFinite(costBasisInput)
        ? costBasisInput
        : finalUnitValue;

    const snapshotResult = await createPositionSnapshot({
      position_id: position.id,
      date: formatUTCDateKey(snapshotDate),
      quantity,
      unit_value: finalUnitValue,
      cost_basis_per_unit: finalCostBasis,
    });

    if (!snapshotResult.success) return snapshotResult;

    revalidatePath("/dashboard", "layout");
    return { success: true } as const;
  }

  // Replay check before the duplicate-name check: the committed position from
  // the first attempt carries this same name, so re-validating it would
  // wrongly fail with DUPLICATE_NAME.
  if (idempotencyKey !== null) {
    const committedPosition =
      await fetchCommittedPositionByIdempotencyKey(idempotencyKey);

    if (committedPosition) {
      return finalizePosition(committedPosition);
    }
  }

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
    let resolved = await resolveSymbolInput(rawSymbolInput);

    if (!resolved?.symbol?.id) {
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

      resolved = await resolveSymbolInput(rawSymbolInput);
      if (!resolved?.symbol?.id) {
        return {
          success: false,
          code: "SYMBOL_RESOLUTION_FAILED",
          message:
            "Symbol metadata was created but could not be resolved to a canonical identifier.",
        } as const;
      }
    }

    symbolUuid = resolved.symbol.id;
    // Symbol-linked positions must use the symbol's normalized trading
    // currency (e.g. GBp -> GBP): callers like the AI write tool may pass a
    // different code, which would skew every later valuation and FX step.
    currency = resolved.symbol.currency;
  }

  // Create position
  const { data: positionRow, error: positionError } = await supabase
    .from("positions")
    .insert({
      user_id: user.id,
      type,
      name,
      currency,
      category_id: categorySelection.category_id,
      user_category_id: categorySelection.user_category_id,
      description,
      symbol_id: symbolUuid,
      domain_id: domainId,
      capital_gains_tax_rate: capitalGainsTaxRate,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (!positionRow || positionError) {
    // Unique violation on the idempotency key means this exact create already
    // committed (race with a retry) — finalize the committed position instead
    // of failing on the duplicate insert.
    if (idempotencyKey !== null && positionError?.code === "23505") {
      const committedPosition =
        await fetchCommittedPositionByIdempotencyKey(idempotencyKey);

      if (committedPosition) {
        return finalizePosition(committedPosition);
      }
    }

    return {
      success: false,
      code: positionError?.code || "POSITION_CREATE_FAILED",
      message: positionError?.message || "Failed to create position",
    } as const;
  }

  // Initial snapshot (synthetic) + cache revalidation
  return finalizePosition({ id: positionRow.id, symbol_id: symbolUuid });
}
