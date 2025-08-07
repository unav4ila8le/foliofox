import type { CSVHoldingRow } from "./index";

/**
 * Validation context containing supported categories and currencies
 */
interface ValidationContext {
  supportedCategories: string[];
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
  holding: CSVHoldingRow,
  rowNumber: number,
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  // Validate name
  if (!holding.name.trim()) {
    errors.push(`Row ${rowNumber}: Name is required`);
  }

  // Validate category
  if (!holding.category_code.trim()) {
    errors.push(`Row ${rowNumber}: Category is required`);
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
  if (isNaN(holding.current_quantity)) {
    errors.push(
      `Row ${rowNumber}: Quantity must be a valid number (e.g. 16.2)`,
    );
  } else if (holding.current_quantity < 0) {
    errors.push(`Row ${rowNumber}: Quantity must be 0 or greater`);
  }

  // Validate unit value
  if (holding.symbol_id && holding.symbol_id.trim() !== "") {
    // For holdings with symbols, unit value is optional (will be fetched from market)
    if (!isNaN(holding.current_unit_value) && holding.current_unit_value < 0) {
      errors.push(
        `Row ${rowNumber}: Unit value must be 0 or greater (if provided)`,
      );
    }
  } else {
    // For holdings without symbols, unit value is required
    if (isNaN(holding.current_unit_value)) {
      errors.push(
        `Row ${rowNumber}: Unit value must be a valid number (e.g. 4420.69)`,
      );
    } else if (holding.current_unit_value < 0) {
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
  holding: CSVHoldingRow,
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
