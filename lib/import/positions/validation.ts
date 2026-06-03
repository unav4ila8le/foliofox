import { fetchCurrencies } from "@/server/currencies/fetch";
import { normalizeProviderQuoteUnit } from "@/server/market-data/quote-units";
import {
  validateSymbolsBatch,
  type SymbolValidationResult,
} from "@/server/symbols/validate";
import { normalizeCapitalGainsTaxRateToDecimal } from "@/lib/capital-gains-tax-rate";

// Categories are normalized via mapper upstream; no need to validate codes here

import type { PositionImportRow } from "./types";

function scaleNullableAmount(
  amount: number | null,
  quoteToCurrencyRate: number,
): number | null {
  return amount == null ? null : amount * quoteToCurrencyRate;
}

type SymbolBackedQuoteUnitNormalization =
  | { status: "not_applicable" }
  | { status: "normalized"; warning: string }
  | { status: "mismatched_quote_unit"; error: string };

function normalizeSymbolBackedQuoteUnit(
  position: PositionImportRow,
  symbolCurrency: string,
  rowNumber: number,
): SymbolBackedQuoteUnitNormalization {
  // Broker exports can use provider quote units for listed securities
  // (GBX/GBp pence, KWF fils). If the symbol confirms the matching ISO
  // accounting currency, scale per-unit amounts before validation/persistence.
  const quoteUnit = normalizeProviderQuoteUnit(position.currency);

  if (!quoteUnit.success) {
    return { status: "not_applicable" };
  }

  if (quoteUnit.data.quoteToCurrencyRate === 1) {
    return { status: "not_applicable" };
  }

  if (quoteUnit.data.currency !== symbolCurrency) {
    return {
      status: "mismatched_quote_unit",
      error: `Row ${rowNumber}: Quote unit ${position.currency} normalizes to ${quoteUnit.data.currency}, but symbol lookup "${position.symbolLookup}" uses ${symbolCurrency}. Check the symbol or currency column before importing.`,
    };
  }

  const originalCurrency = position.currency;
  const scaledFields: string[] = [];

  if (position.unit_value != null) {
    position.unit_value = scaleNullableAmount(
      position.unit_value,
      quoteUnit.data.quoteToCurrencyRate,
    );
    scaledFields.push("unit value");
  }

  if (position.cost_basis_per_unit != null) {
    position.cost_basis_per_unit = scaleNullableAmount(
      position.cost_basis_per_unit,
      quoteUnit.data.quoteToCurrencyRate,
    );
    scaledFields.push("cost basis");
  }

  position.currency = symbolCurrency;

  const scaledSuffix =
    scaledFields.length > 0
      ? ` and scaled ${scaledFields.join(" and ")} by ${quoteUnit.data.quoteToCurrencyRate}`
      : "";

  return {
    status: "normalized",
    warning: `Normalized quote unit ${originalCurrency} for ${position.symbolLookup} to ${symbolCurrency}${scaledSuffix}`,
  };
}

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
 * - Adjusts currency to the symbol's normalized ISO accounting currency
 * - Normalizes symbol id when possible
 * - Returns warnings describing adjustments made
 */
export async function normalizePositionsArray(
  rows: PositionImportRow[],
): Promise<{
  positions: PositionImportRow[];
  warnings: string[];
  errors: string[];
  symbolValidationResults?: Map<string, SymbolValidationResult>;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];

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
    return { positions: cloned, warnings, errors };
  }

  const batch = await validateSymbolsBatch(symbols);

  cloned.forEach((h, index) => {
    if (!h.symbolLookup) return;
    const v = batch.results.get(h.symbolLookup);
    if (!v) return;

    if (v.currency && h.currency !== v.currency) {
      const quoteUnitNormalization = normalizeSymbolBackedQuoteUnit(
        h,
        v.currency,
        index + 1,
      );

      if (quoteUnitNormalization.status === "normalized") {
        warnings.push(quoteUnitNormalization.warning);
      } else if (quoteUnitNormalization.status === "mismatched_quote_unit") {
        // Do not rewrite the row when a quote unit points at a different ISO
        // currency than the symbol. Keeping the original input visible prevents
        // pence/fils amounts from being treated as an unrelated major currency.
        errors.push(quoteUnitNormalization.error);
      } else {
        warnings.push(
          `Adjusted accounting currency for ${h.symbolLookup} from ${h.currency} to ${v.currency}`,
        );
        h.currency = v.currency;
      }
    }

    if (v.normalized && v.normalized !== h.symbolLookup) {
      warnings.push(`Normalized symbol ${h.symbolLookup} to ${v.normalized}`);
      h.symbolLookup = v.normalized;
    }
  });

  return {
    positions: cloned,
    warnings,
    errors,
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
 * @param symbolCurrency - The normalized ISO accounting currency from symbol validation
 * @returns Array of validation errors (empty if valid)
 */
export function validateSymbolCurrency(
  position: PositionImportRow,
  rowNumber: number,
  symbolCurrency: string,
): string[] {
  if (symbolCurrency && symbolCurrency !== position.currency) {
    return [
      `Row ${rowNumber}: Symbol lookup "${position.symbolLookup}" uses ${symbolCurrency} as its normalized ISO accounting currency, but CSV specifies ${position.currency}. Please use ${symbolCurrency} for this symbol.`,
    ];
  }
  return [];
}
