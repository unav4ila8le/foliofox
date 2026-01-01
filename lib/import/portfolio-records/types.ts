/**
 * Portfolio Record Import Types
 *
 * Types specific to portfolio record imports.
 */

export type PortfolioRecordImportRow = {
  position_name: string; // To match the position
  type: "buy" | "sell" | "update";
  date: string;
  quantity: number;
  unit_value: number;
  description: string | null;
};

export interface PortfolioRecordImportResult {
  success: boolean;
  records: PortfolioRecordImportRow[];
  warnings?: string[];
  errors?: string[];
}
