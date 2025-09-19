export interface HoldingRow {
  name: string;
  category_code: string;
  currency: string;
  current_quantity: number;
  current_unit_value: number | null;
  cost_basis_per_unit: number | null;
  symbol_id: string | null;
  description: string | null;
}

export interface ImportResult {
  success: boolean;
  holdings: HoldingRow[];
  warnings?: string[];
  errors?: string[];
}

export type ImportActionResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };
