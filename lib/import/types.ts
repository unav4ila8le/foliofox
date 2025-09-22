import type { HoldingRow } from "@/types/global.types";
import type { SymbolValidationResult } from "@/server/symbols/validate";

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
