import { z } from "zod";

import { fetchPositionCategories } from "@/server/position-categories/fetch";
import { fetchCurrencies } from "@/server/currencies/fetch";

import {
  normalizePositionsArray,
  validatePositionsArray,
} from "@/lib/import/parser/validation";

import type {
  PositionImportRow,
  PositionImportResult,
} from "@/lib/import/types";

export type ExtractionResult = {
  success: boolean;
  positions?: Array<{
    name: string;
    category_id: string;
    currency: string;
    quantity: number;
    unit_value?: number | null;
    cost_basis_per_unit?: number | null;
    symbol_id?: string | null;
    description?: string | null;
  }>;
  error?: string | null;
  warnings?: Array<string | { warning: string }> | null;
};

// Warning schema
const WarningSchema = z.union([z.string(), z.object({ warning: z.string() })]);

// Function to create the position row schema with dynamic categories
async function createPositionRowSchema() {
  const positionCategories = await fetchPositionCategories("asset");
  const categoryIds = positionCategories.map((cat) => cat.id);

  return z.object({
    name: z.string().min(3).max(64),
    category_id: z.enum(categoryIds),
    currency: z.string().length(3),
    quantity: z.number().gte(0),
    unit_value: z.number().gte(0).nullable().optional(),
    cost_basis_per_unit: z.number().gte(0).nullable().optional(),
    symbol_id: z.string().nullable().optional(),
    description: z.string().max(256).nullable().optional(),
  });
}

// Function to create extraction result schema with dynamic categories
export async function createExtractionResultSchema() {
  const PositionRowSchema = await createPositionRowSchema();

  return z.object({
    success: z.boolean(),
    positions: z.array(PositionRowSchema).optional(),
    error: z.string().nullable().optional(),
    warnings: z.array(WarningSchema).nullable().optional(),
  });
}

// Function to create prompt with dynamic categories
export async function createExtractionPrompt(): Promise<string> {
  const positionCategories = await fetchPositionCategories("asset");
  const categoryIds = positionCategories.map((cat) => cat.id);
  const categoriesList = categoryIds.join(", ");

  return `You are a precise financial document parser. Extract ONLY portfolio positions (assets), not transactions, totals, or P/L.

Return data that strictly matches the provided JSON schema. Do not invent values:
- If a field is unreadable or not present, set it to null and add a helpful warning in "warnings".
- Currency must be a 3-letter ISO 4217 code in uppercase (e.g., USD, EUR, CHF). Do not include symbols.
- When symbol_id is present, set currency to the symbol's native trading currency from Yahoo Finance, never the page's base/portfolio currency.
- Quantity can be fractional, must be >= 0.
- Unit numbers: strip thousand separators, use "." for decimals, no currency symbols.
- category_id must be one of: ${categoriesList}.
- For cash balances, keep the currency exactly as shown on the statement (CHF/EUR/USD/etc.). Do not convert to USD or warn if not USD; only ensure it is a valid 3‑letter ISO 4217 code.
- For cash balances, output a 'cash' position with quantity set to the cash amount and unit_value set to 1.
- For cryptocurrencies, set symbol_id to the Yahoo Finance crypto pair with "-USD" (e.g., BTC-USD, ETH-USD, XRP-USD). If only the coin code is visible, output the "-USD" pair. Set currency to USD for cryptocurrencies.
- For listed securities with a recognizable symbol (Yahoo Finance tickers, e.g., AAPL, VT, VWCE.DE), set symbol_id and you MAY set unit_value to null (it will be fetched).
- If a row looks like a tradable ticker (uppercase letters/numbers 1–8 chars, e.g., PLTR, NVDA, QQQ), you MUST set symbol_id to that ticker. If uncertain, set your best guess and add a warning like "symbol uncertain". Do not leave symbol_id empty for listed securities.
- cost_basis_per_unit: if an explicit "avg cost"/"average price"/"cost basis"/etc. column exists, set it; otherwise set null. It must be in the same currency as "currency".
 - If multiple rows refer to the same symbol/name, prefer a single merged position summing quantities. If cost basis differs across rows, set cost_basis_per_unit to null and add a warning.
- Use full company names for the "name" field (e.g., "Ford Motor Company", "Toyota Motor Corporation"), not ticker symbols. Symbols go in "symbol_id".

Output guidance:
- Set success=false with a clear error if no positions can be extracted.
- Otherwise success=true, include positions[], and warnings[] for any low-confidence fields.
- Do NOT warn when unit_value is missing for rows with symbol_id; that value is fetched automatically.

Now analyze the attached file and extract the positions.`;
}

export async function postProcessExtractedPositions(
  obj: ExtractionResult,
): Promise<PositionImportResult> {
  // If no positions extracted at all, return failure with empty positions
  if (!obj.positions || obj.positions.length === 0) {
    const warnRaw = obj.warnings ?? [];
    const baseWarnings = warnRaw.map((w) =>
      typeof w === "string" ? w : w.warning,
    );
    return {
      success: false,
      positions: [],
      warnings: baseWarnings.length ? baseWarnings : undefined,
      errors: obj.error ? [obj.error] : ["AI extraction failed"],
    };
  }

  const initial: PositionImportRow[] = obj.positions.map((p) => ({
    name: p.name,
    category_id: p.category_id,
    currency: p.currency,
    quantity: p.quantity,
    unit_value: p.unit_value ?? null,
    cost_basis_per_unit: p.cost_basis_per_unit ?? null,
    symbol_id: p.symbol_id ?? null,
    description: p.description ?? null,
  }));

  // Normalize positions using shared helper (adjust currency/symbol)
  const {
    positions: normalizedPositions,
    warnings: normalizationWarnings,
    symbolValidationResults,
  } = await normalizePositionsArray(initial);

  // Run shared validation
  const { errors: validationErrors } = await validatePositionsArray(
    normalizedPositions,
    symbolValidationResults,
  );

  // Map raw warnings and merge with normalization warnings
  const warnRaw = obj.warnings ?? [];
  const baseWarnings = warnRaw.map((w) =>
    typeof w === "string" ? w : w.warning,
  );
  const mergedWarnings = [...baseWarnings, ...normalizationWarnings];

  // Convert Map to Record for JSON-friendly shape
  const symbolValidation = symbolValidationResults
    ? Object.fromEntries(symbolValidationResults)
    : undefined;
  // Fetch supported currencies
  const supportedCurrencies = (await fetchCurrencies()).map(
    (c) => c.alphabetic_code,
  );

  if (validationErrors.length > 0) {
    // Validation failed: return parsed positions alongside errors so user can review/fix
    return {
      success: false,
      positions: normalizedPositions,
      warnings: mergedWarnings.length ? mergedWarnings : undefined,
      errors: validationErrors,
      symbolValidation,
      supportedCurrencies,
    };
  }

  return {
    success: true,
    positions: normalizedPositions,
    warnings: mergedWarnings.length ? mergedWarnings : undefined,
    symbolValidation,
    supportedCurrencies,
  };
}
