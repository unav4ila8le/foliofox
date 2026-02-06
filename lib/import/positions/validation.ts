import { fetchCurrencies } from "@/server/currencies/fetch";
import {
  validateSymbolsBatch,
  type SymbolValidationResult,
} from "@/server/symbols/validate";
import { normalizeCapitalGainsTaxRateToDecimal } from "@/lib/capital-gains-tax-rate";

// Categories are normalized via mapper upstream; no need to validate codes here

import type { PositionImportRow } from "./types";

/**
 * Validates an array of positions with optional pre-validated symbol results
 * @param rows - The positions to validate
 * @param symbolValidationResults - Optional pre-validated symbol results to avoid duplicate API calls
 * @returns Array of validation errors (empty if valid)
 */
export async function validatePositionsArray(
  rows: PositionImportRow[],
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
    errors.push(...validatePosition(row, idx + 1, context));
  });

  // Symbol checks (existence + currency mismatch)
  const symbols = rows
    .map((r) => (r.symbolLookup || "").trim())
    .filter(Boolean);

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
      if (!row.symbolLookup) return;
      const v = batch.results.get(row.symbolLookup);
      if (!v) return;
      if (!v.valid) {
        errors.push(
          v.error || `Row ${idx + 1}: Invalid symbol "${row.symbolLookup}"`,
        );
      } else if (v.currency) {
        errors.push(...validateSymbolCurrency(row, idx + 1, v.currency));
      }
    });
  }

  return { errors };
}

/**
 * Normalize positions using symbol metadata (currency and normalized symbol id)
 * - Adjusts currency to the symbol's native trading currency
 * - Normalizes symbol id when possible
 * - Returns warnings describing adjustments made
 */
export async function normalizePositionsArray(
  rows: PositionImportRow[],
): Promise<{
  positions: PositionImportRow[];
  warnings: string[];
  symbolValidationResults?: Map<string, SymbolValidationResult>;
}> {
  const warnings: string[] = [];

  // Clone rows to avoid mutating input
  const cloned = rows.map((h) => ({ ...h }));

  // Normalize plain crypto codes to "-USD" and force USD currency
  cloned.forEach((h) => {
    if (
      h.category_id === "cryptocurrency" &&
      h.symbolLookup &&
      !h.symbolLookup.includes("-")
    ) {
      const code = h.symbolLookup.toUpperCase().trim();
      const normalized = `${code}-USD`;
      warnings.push(
        `Normalized crypto symbol ${h.symbolLookup} to ${normalized}`,
      );
      h.symbolLookup = normalized;
      if (h.currency !== "USD") {
        warnings.push(
          `Adjusted currency for ${normalized} from ${h.currency} to USD`,
        );
        h.currency = "USD";
      }
    }
  });

  const symbols = cloned
    .map((r) => (r.symbolLookup || "").trim())
    .filter(Boolean);
  if (symbols.length === 0) {
    return { positions: cloned, warnings };
  }

  const batch = await validateSymbolsBatch(symbols);

  cloned.forEach((h) => {
    if (!h.symbolLookup) return;
    const v = batch.results.get(h.symbolLookup);
    if (!v) return;

    if (v.currency && h.currency !== v.currency) {
      warnings.push(
        `Adjusted currency for ${h.symbolLookup} from ${h.currency} to ${v.currency}`,
      );
      h.currency = v.currency;
    }

    if (v.normalized && v.normalized !== h.symbolLookup) {
      warnings.push(`Normalized symbol ${h.symbolLookup} to ${v.normalized}`);
      h.symbolLookup = v.normalized;
    }
  });

  return {
    positions: cloned,
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
 * Validates a single position row
 * @param position - The position to validate
 * @param rowNumber - The row number for error reporting
 * @param context - Validation context with supported values
 * @returns Array of validation errors (empty if valid)
 */
export function validatePosition(
  position: PositionImportRow,
  rowNumber: number,
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  // Validate name
  if (!position.name.trim()) {
    errors.push(`Row ${rowNumber}: Name is required`);
  }

  // Validate currency
  if (!position.currency.trim()) {
    errors.push(`Row ${rowNumber}: Currency is required`);
  } else {
    if (position.currency.length !== 3) {
      errors.push(
        `Row ${rowNumber}: Currency must be 3-character ISO 4217 code (e.g., USD, EUR, GBP)`,
      );
    } else if (!context.supportedCurrencies.includes(position.currency)) {
      errors.push(
        `Row ${rowNumber}: Currency "${position.currency}" is not supported`,
      );
    }
  }

  // Validate quantity
  if (isNaN(position.quantity)) {
    errors.push(
      `Row ${rowNumber}: Quantity must be a valid number (e.g. 16.2)`,
    );
  } else if (position.quantity < 0) {
    errors.push(`Row ${rowNumber}: Quantity must be 0 or greater`);
  }

  // Validate unit value
  if (position.symbolLookup && position.symbolLookup.trim() !== "") {
    // Optional if symbol provided (will be fetched from market); if present, must be >= 0
    if (position.unit_value != null && position.unit_value < 0) {
      errors.push(
        `Row ${rowNumber}: Unit value must be 0 or greater (if provided)`,
      );
    }
  } else {
    // Required when no symbol provided
    if (position.unit_value == null) {
      errors.push(
        `Row ${rowNumber}: Unit value is required when no symbol is provided`,
      );
    } else if (position.unit_value < 0) {
      errors.push(`Row ${rowNumber}: Unit value must be 0 or greater`);
    }
  }

  // Validate capital gains tax rate (optional; accepts decimal or percentage)
  if (position.capital_gains_tax_rate != null) {
    const normalizedTaxRate = normalizeCapitalGainsTaxRateToDecimal(
      position.capital_gains_tax_rate,
    );
    if (Number.isNaN(normalizedTaxRate)) {
      errors.push(
        `Row ${rowNumber}: Capital gains tax rate must be between 0 and 100 (or between 0 and 1 as decimal)`,
      );
    }
  }

  return errors;
}

/**
 * Validates symbol currency matches CSV currency
 * @param position - The position to validate
 * @param rowNumber - The row number for error reporting
 * @param symbolCurrency - The currency from symbol validation
 * @returns Array of validation errors (empty if valid)
 */
export function validateSymbolCurrency(
  position: PositionImportRow,
  rowNumber: number,
  symbolCurrency: string,
): string[] {
  if (symbolCurrency && symbolCurrency !== position.currency) {
    return [
      `Row ${rowNumber}: Symbol lookup "${position.symbolLookup}" uses ${symbolCurrency} currency, but CSV specifies ${position.currency}. Please use ${symbolCurrency} for this symbol.`,
    ];
  }
  return [];
}
