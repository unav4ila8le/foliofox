"use server";

import { createPortfolioRecord as createPortfolioRecordMutation } from "@/server/portfolio-records/create";
import { resolvePositionLookup } from "@/server/positions/resolve-position-lookup";

interface CreatePortfolioRecordParams {
  summary: string;
  positionId: string;
  type: "buy" | "sell" | "update";
  date: string; // YYYY-MM-DD
  quantity: number;
  unitValue: number;
  description: string | null;
  costBasisPerUnit: number | null;
  idempotencyKey: string | null;
}

/**
 * Approval-gated write tool: marshals typed AI tool args into the FormData
 * shape of the shared createPortfolioRecord mutation (single write path used
 * by forms and imports). `summary` is consumed by the approval UI only.
 */
export async function createPortfolioRecord(
  params: CreatePortfolioRecordParams,
) {
  // Model-supplied position ids are untrusted: a stale or invented UUID passes
  // timeline validation (no prior records) and surfaces as a raw FK violation.
  // Validate before inserting, but accept only canonical UUIDs for writes:
  // ticker aliases are reusable across securities (a retired ticker can be
  // re-registered), and approval happens before execution, so a ticker match
  // could silently commit the record against the wrong position.
  let resolvedPositionId: string;
  try {
    const resolved = await resolvePositionLookup({
      lookup: params.positionId,
      includeArchived: false,
    });

    if (resolved.matchedBy !== "position_id") {
      return {
        success: false,
        code: "POSITION_UUID_REQUIRED",
        message:
          `Writes require the position UUID, not a ticker. "${params.positionId}" ` +
          `currently resolves to "${resolved.positionName}" (${resolved.positionId}). ` +
          `Verify this is the intended position, then retry with its UUID from ` +
          `getPortfolioOverview or getPositions (positions[].id).`,
      } as const;
    }

    resolvedPositionId = resolved.positionId;
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Unable to resolve the position.";
    return {
      success: false,
      code: "POSITION_NOT_FOUND",
      message: `${reason} Fetch the position UUID via getPortfolioOverview or getPositions (positions[].id) and retry with that exact id.`,
    } as const;
  }

  const formData = new FormData();
  formData.set("position_id", resolvedPositionId);
  formData.set("type", params.type);
  formData.set("date", params.date);
  formData.set("quantity", String(params.quantity));
  formData.set("unit_value", String(params.unitValue));
  if (params.description != null) {
    formData.set("description", params.description);
  }
  if (params.costBasisPerUnit != null) {
    formData.set("cost_basis_per_unit", String(params.costBasisPerUnit));
  }
  if (params.idempotencyKey != null) {
    formData.set("idempotency_key", params.idempotencyKey);
  }

  return createPortfolioRecordMutation(formData);
}
