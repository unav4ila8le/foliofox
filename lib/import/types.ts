import type { SymbolValidationResult } from "@/server/symbols/validate";

export type HoldingRow = {
  name: string;
  category_code: string;
  currency: string;
  quantity: number;
  unit_value: number | null;
  cost_basis_per_unit: number | null;
  symbol_id: string | null;
  description: string | null;
};

export interface ImportResult {
  success: boolean;
  holdings: HoldingRow[];
  warnings?: string[];
  errors?: string[];
  symbolValidation?: Record<string, SymbolValidationResult>;
  supportedCurrencies?: string[];
}

export type ImportActionResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };
