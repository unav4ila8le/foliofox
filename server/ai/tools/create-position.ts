"use server";

import { createPosition as createPositionMutation } from "@/server/positions/create";

interface CreatePositionParams {
  summary: string;
  name: string;
  currency: string;
  type: "asset" | "liability" | null;
  categoryId: string | null;
  userCategoryId: string | null;
  symbolLookup: string | null;
  quantity: number | null;
  unitValue: number | null;
  costBasisPerUnit: number | null;
  capitalGainsTaxRate: number | null;
  date: string; // YYYY-MM-DD
  description: string | null;
}

/**
 * Approval-gated write tool: marshals typed AI tool args into the FormData
 * shape of the shared createPosition mutation (single write path used by
 * forms and imports). `summary` is consumed by the approval UI only.
 * Omitted optionals keep the mutation defaults (quantity 0, quote-derived
 * unit value when a symbol is provided, category fallback "other").
 */
export async function createPosition(params: CreatePositionParams) {
  const formData = new FormData();
  formData.set("name", params.name);
  formData.set("currency", params.currency);
  if (params.type != null) {
    formData.set("type", params.type);
  }
  if (params.categoryId != null) {
    formData.set("category_id", params.categoryId);
  }
  if (params.userCategoryId != null) {
    formData.set("user_category_id", params.userCategoryId);
  }
  if (params.symbolLookup != null) {
    formData.set("symbolLookup", params.symbolLookup);
  }
  if (params.quantity != null) {
    formData.set("quantity", String(params.quantity));
  }
  if (params.unitValue != null) {
    formData.set("unit_value", String(params.unitValue));
  }
  if (params.costBasisPerUnit != null) {
    formData.set("cost_basis_per_unit", String(params.costBasisPerUnit));
  }
  // The schema guarantees a 0-100 percentage; the DB stores a 0..1 decimal.
  // Always divide (no mixed-unit heuristic) so 1 means 1%, not 100%.
  if (params.capitalGainsTaxRate != null) {
    formData.set(
      "capital_gains_tax_rate",
      String(params.capitalGainsTaxRate / 100),
    );
  }
  formData.set("date", params.date);
  if (params.description != null) {
    formData.set("description", params.description);
  }

  return createPositionMutation(formData);
}
