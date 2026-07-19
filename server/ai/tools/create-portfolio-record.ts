"use server";

import { createPortfolioRecord as createPortfolioRecordMutation } from "@/server/portfolio-records/create";

interface CreatePortfolioRecordParams {
  summary: string;
  positionId: string;
  type: "buy" | "sell" | "update";
  date: string; // YYYY-MM-DD
  quantity: number;
  unitValue: number;
  description: string | null;
  costBasisPerUnit: number | null;
}

/**
 * Approval-gated write tool: marshals typed AI tool args into the FormData
 * shape of the shared createPortfolioRecord mutation (single write path used
 * by forms and imports). `summary` is consumed by the approval UI only.
 */
export async function createPortfolioRecord(
  params: CreatePortfolioRecordParams,
) {
  const formData = new FormData();
  formData.set("position_id", params.positionId);
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

  return createPortfolioRecordMutation(formData);
}
