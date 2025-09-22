import { fetchCurrencies } from "@/server/currencies/fetch";
import {
  validateSymbolsBatch,
  type SymbolValidationResult,
} from "@/server/symbols/validate";

// Categories are normalized via mapper upstream; no need to validate codes here

import type { HoldingRow } from "@/lib/import/types";

/**
 * Validates an array of holdings with optional pre-validated symbol results
 * @param rows - The holdings to validate
 * @param symbolValidationResults - Optional pre-validated symbol results to avoid duplicate API calls
 * @returns Array of validation errors (empty if valid)
 */
export async function validateHoldingsArray(
  rows: HoldingRow[],
  symbolValidationResults?: Map<string, SymbolValidationResult>,
): Promise<{ errors: string[] }> {
  const errors: string[] = [];

  // Build context
  const supportedCurrencies = (await fetchCurrencies()).map(
    (c) => c.alphabetic_code,
  );
  const context = {
    supportedCurrencies,
  };

  // Row-level checks (name, category present, currency supported, quantity, unit_value rules)
  rows.forEach((row, idx) => {
    errors.push(...validateHolding(row, idx + 1, context));
  });

  // Symbol checks (existence + currency mismatch)
  const symbols = rows.map((r) => (r.symbol_id || "").trim()).filter(Boolean);

  if (symbols.length > 0) {
    let batch: Awaited<ReturnType<typeof validateSymbolsBatch>>;

    if (symbolValidationResults) {
      // Use pre-validated results
      batch = {
        valid: Array.from(symbolValidationResults.values()).every(
          (r) => r.valid,
        ),
        results: symbolValidationResults,
        errors: Array.from(symbolValidationResults.values())
          .filter((r) => !r.valid)
          .map((r) => r.error || "Unknown error"),
      };
    } else {
      // Validate symbols now
      batch = await validateSymbolsBatch(symbols);
    }

    rows.forEach((row, idx) => {
      if (!row.symbol_id) return;
      const v = batch.results.get(row.symbol_id);
      if (!v) return;
      if (!v.valid) {
        errors.push(
          v.error || `Row ${idx + 1}: Invalid symbol "${row.symbol_id}"`,
        );
      } else if (v.currency) {
        errors.push(...validateSymbolCurrency(row, idx + 1, v.currency));
      }
    });
  }

  return { errors };
}

/**
 * Normalize holdings using symbol metadata (currency and normalized symbol id)
 * - Adjusts currency to the symbol's native trading currency
 * - Normalizes symbol id when possible
 * - Returns warnings describing adjustments made
 */
export async function normalizeHoldingsArray(rows: HoldingRow[]): Promise<{
  holdings: HoldingRow[];
  warnings: string[];
  symbolValidationResults?: Map<string, SymbolValidationResult>;
}> {
  const warnings: string[] = [];

  // Clone rows to avoid mutating input
  const cloned = rows.map((h) => ({ ...h }));

  // Normalize plain crypto codes to "-USD" and force USD currency
  cloned.forEach((h) => {
    if (
      h.category_code === "cryptocurrency" &&
      h.symbol_id &&
      !h.symbol_id.includes("-")
    ) {
      const code = h.symbol_id.toUpperCase().trim();
      const normalized = `${code}-USD`;
      warnings.push(`Normalized crypto symbol ${h.symbol_id} to ${normalized}`);
      h.symbol_id = normalized;
      if (h.currency !== "USD") {
        warnings.push(
          `Adjusted currency for ${normalized} from ${h.currency} to USD`,
        );
        h.currency = "USD";
      }
    }
  });

  const symbols = cloned.map((r) => (r.symbol_id || "").trim()).filter(Boolean);
  if (symbols.length === 0) {
    return { holdings: cloned, warnings };
  }

  const batch = await validateSymbolsBatch(symbols);

  cloned.forEach((h) => {
    if (!h.symbol_id) return;
    const v = batch.results.get(h.symbol_id);
    if (!v) return;

    if (v.currency && h.currency !== v.currency) {
      warnings.push(
        `Adjusted currency for ${h.symbol_id} from ${h.currency} to ${v.currency}`,
      );
      h.currency = v.currency;
    }

    if (v.normalized && v.normalized !== h.symbol_id) {
      warnings.push(`Normalized symbol ${h.symbol_id} to ${v.normalized}`);
      h.symbol_id = v.normalized;
    }
  });

  return {
    holdings: cloned,
    warnings,
    symbolValidationResults: batch.results,
  };
}

/**
 * Validation context containing supported categories and currencies
 */
interface ValidationContext {
  supportedCurrencies: string[];
}

/**
 * Validates a single holding row
 * @param holding - The holding to validate
 * @param rowNumber - The row number for error reporting
 * @param context - Validation context with supported values
 * @returns Array of validation errors (empty if valid)
 */
export function validateHolding(
  holding: HoldingRow,
  rowNumber: number,
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  // Validate name
  if (!holding.name.trim()) {
    errors.push(`Row ${rowNumber}: Name is required`);
  }

  // Validate currency
  if (!holding.currency.trim()) {
    errors.push(`Row ${rowNumber}: Currency is required`);
  } else {
    if (holding.currency.length !== 3) {
      errors.push(
        `Row ${rowNumber}: Currency must be 3-character ISO 4217 code (e.g., USD, EUR, GBP)`,
      );
    } else if (!context.supportedCurrencies.includes(holding.currency)) {
      errors.push(
        `Row ${rowNumber}: Currency "${holding.currency}" is not supported`,
      );
    }
  }

  // Validate quantity
  if (isNaN(holding.quantity)) {
    errors.push(
      `Row ${rowNumber}: Quantity must be a valid number (e.g. 16.2)`,
    );
  } else if (holding.quantity < 0) {
    errors.push(`Row ${rowNumber}: Quantity must be 0 or greater`);
  }

  // Validate unit value
  if (holding.symbol_id && holding.symbol_id.trim() !== "") {
    // Optional if symbol provided (will be fetched from market); if present, must be >= 0
    if (holding.unit_value != null && holding.unit_value < 0) {
      errors.push(
        `Row ${rowNumber}: Unit value must be 0 or greater (if provided)`,
      );
    }
  } else {
    // Required when no symbol provided
    if (holding.unit_value == null) {
      errors.push(
        `Row ${rowNumber}: Unit value is required when no symbol is provided`,
      );
    } else if (holding.unit_value < 0) {
      errors.push(`Row ${rowNumber}: Unit value must be 0 or greater`);
    }
  }

  return errors;
}

/**
 * Validates symbol currency matches CSV currency
 * @param holding - The holding to validate
 * @param rowNumber - The row number for error reporting
 * @param symbolCurrency - The currency from symbol validation
 * @returns Array of validation errors (empty if valid)
 */
export function validateSymbolCurrency(
  holding: HoldingRow,
  rowNumber: number,
  symbolCurrency: string,
): string[] {
  if (symbolCurrency && symbolCurrency !== holding.currency) {
    return [
      `Row ${rowNumber}: Symbol "${holding.symbol_id}" uses ${symbolCurrency} currency, but CSV specifies ${holding.currency}. Please use ${symbolCurrency} for this symbol.`,
    ];
  }
  return [];
}
