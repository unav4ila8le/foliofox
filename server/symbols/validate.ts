"use server";

import {
  fetchYahooFinanceSymbol,
  searchYahooFinanceSymbols,
} from "@/server/symbols/search";

// Types for validation results
export interface SymbolValidationResult {
  valid: boolean;
  normalized?: string;
  currency?: string;
  suggestions?: string[];
  error?: string;
}

/**
 * Validate and normalize a single symbol
 * @param symbolId - The symbol to validate
 * @returns Validation result with suggestions if invalid
 */
export async function validateSymbol(symbolId: string) {
  try {
    // Clean up the symbol (remove exchange prefixes, etc.)
    const cleanedSymbol = await normalizeSymbol(symbolId);

    // 1. Try exact match first (fastest)
    const exactMatch = await fetchYahooFinanceSymbol(cleanedSymbol);
    if (exactMatch.success) {
      return {
        valid: true,
        normalized: cleanedSymbol,
        currency: exactMatch.data?.currency,
      };
    }

    // 2. Try fuzzy search for suggestions
    const fuzzyMatch = await searchYahooFinanceSymbols({
      query: cleanedSymbol,
      limit: 5,
    });

    if (fuzzyMatch.success && fuzzyMatch.data && fuzzyMatch.data.length > 0) {
      const suggestions = fuzzyMatch.data
        .map((s) => s.id)
        .filter((s) => s && s.trim() !== "");
      return {
        valid: false,
        suggestions,
        error: `Symbol "${symbolId}" not found. Did you mean: ${suggestions.join(", ")}?`,
      };
    }

    return {
      valid: false,
      error: `Symbol "${symbolId}" not found in Yahoo Finance`,
    };
  } catch (error) {
    console.error(`Unexpected error validating symbol "${symbolId}":`, error);
    return {
      valid: false,
      error: `Failed to validate symbol "${symbolId}": ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate multiple symbols in parallel (for CSV imports)
 * @param symbols - Array of symbols to validate
 * @returns Batch validation result
 */
export async function validateSymbolsBatch(symbols: string[]) {
  const results = new Map<string, SymbolValidationResult>();
  const errors: string[] = [];

  // Validate all symbols in parallel
  const validationPromises = symbols.map(async (symbol) => {
    const result = await validateSymbol(symbol);
    results.set(symbol, result);

    if (!result.valid) {
      errors.push(result.error || `Unknown error validating ${symbol}`);
    }

    return { symbol, result };
  });

  await Promise.all(validationPromises);

  return {
    valid: errors.length === 0,
    results,
    errors,
  };
}

/**
 * Normalize symbol format (remove exchange prefixes, etc.)
 * @param symbolId - Raw symbol from user input
 * @returns Cleaned symbol
 */
export async function normalizeSymbol(symbolId: string) {
  if (!symbolId) return "";

  // Remove common exchange prefixes
  const cleaned = symbolId
    .toUpperCase()
    .replace(/^(NYSE:|NASDAQ:|LSE:|TSE:|ASX:)/, "")
    .trim();

  return cleaned;
}
