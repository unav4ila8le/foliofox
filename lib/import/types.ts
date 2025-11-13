import type { SymbolValidationResult } from "@/server/symbols/validate";

export type PositionImportRow = {
  name: string;
  category_id: string;
  currency: string;
  quantity: number;
  unit_value: number | null;
  cost_basis_per_unit: number | null;
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

export type ImportActionResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };
