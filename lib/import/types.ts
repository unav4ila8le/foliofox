import type { HoldingRow } from "@/types/global.types";

export interface ImportResult {
  success: boolean;
  holdings: HoldingRow[];
  warnings?: string[];
  errors?: string[];
}

export type ImportActionResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };
