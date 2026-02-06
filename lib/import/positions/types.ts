/**
 * Position Import Types
 *
 * Types specific to position imports.
 */

import type { SymbolValidationResult } from "@/server/symbols/validate";

export type PositionImportRow = {
  name: string;
  category_id: string;
  currency: string;
  quantity: number;
  unit_value: number | null;
  cost_basis_per_unit: number | null;
  capital_gains_tax_rate: number | null;
  symbolLookup: string | null;
  description: string | null;
};

export interface PositionImportResult {
  success: boolean;
  positions: PositionImportRow[];
  warnings?: string[];
  errors?: string[];
  symbolValidation?: Record<string, SymbolValidationResult>;
  supportedCurrencies?: string[];
}
