"use server";

import { fetchCurrencies } from "./fetch";

// Types for validation results
export interface CurrencyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a single currency code
 * @param currency - The currency to validate
 * @returns The validation result
 */
export async function validateCurrency(currency: string) {
  if (!currency.trim()) {
    return { valid: false, error: "Currency is required" };
  }

  if (currency.length !== 3) {
    return {
      valid: false,
      error: "Currency must be 3-character ISO 4217 code (e.g., USD, EUR, GBP)",
    };
  }

  const supportedCurrencies = (await fetchCurrencies()).map(
    (c) => c.alphabetic_code,
  );

  if (!supportedCurrencies.includes(currency.toUpperCase())) {
    return {
      valid: false,
      error: `Currency "${currency}" is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Validates multiple currencies in batch
 * @param currencies - Array of currencies to validate
 * @returns Batch validation result
 */
export async function validateCurrenciesBatch(currencies: string[]) {
  const supportedCurrencies = (await fetchCurrencies()).map(
    (c) => c.alphabetic_code,
  );

  const results = new Map<string, CurrencyValidationResult>();

  currencies.forEach((currency) => {
    if (!currency.trim()) {
      results.set(currency, { valid: false, error: "Currency is required" });
    } else if (currency.length !== 3) {
      results.set(currency, {
        valid: false,
        error:
          "Currency must be 3-character ISO 4217 code (e.g., USD, EUR, GBP)",
      });
    } else if (!supportedCurrencies.includes(currency.toUpperCase())) {
      results.set(currency, {
        valid: false,
        error: `Currency "${currency}" is not supported`,
      });
    } else {
      results.set(currency, { valid: true });
    }
  });

  return { results };
}
