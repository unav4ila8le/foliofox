import { z } from "zod";

import { fetchAssetCategories } from "@/server/asset-categories/fetch";

import {
  normalizeHoldingsArray,
  validateHoldingsArray,
} from "@/lib/import/parser/validation";

import type { HoldingRow, ImportResult } from "../types";

export const HoldingSchema = z.object({
  name: z.string(),
  category_code: z.enum([
    "cash",
    "equity",
    "fixed_income",
    "real_estate",
    "cryptocurrency",
    "commodities",
    "other",
  ]),
  currency: z.string().length(3),
  current_quantity: z.number().min(0),
  current_unit_value: z.number().nullable().optional(),
  cost_basis_per_unit: z.number().nullable().optional(),
  symbol_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const WarningSchema = z.union([z.string(), z.object({ warning: z.string() })]);
export const ExtractionResultSchema = z.object({
  success: z.boolean(),
  holdings: z.array(HoldingSchema).optional(),
  error: z.string().nullable().optional(),
  warnings: z.array(WarningSchema).nullable().optional(),
});

// Function to create prompt with dynamic categories
export async function createExtractionPrompt(): Promise<string> {
  const assetCategories = await fetchAssetCategories();
  const categoryCodes = assetCategories.map((cat) => cat.code);
  const categoriesList = categoryCodes.join(", ");

  return `You are a precise financial document parser. Extract ONLY portfolio holdings/positions, not transactions, totals, or P/L.

Return data that strictly matches the provided JSON schema. Do not invent values:
- If a field is unreadable or not present, set it to null and add a helpful warning in "warnings".
- Currency must be a 3-letter ISO 4217 code in uppercase (e.g., USD, EUR, CHF). Do not include symbols.
- When symbol_id is present, set currency to the symbol's native trading currency from Yahoo Finance, never the page's base/portfolio currency.
- Quantity can be fractional, must be >= 0.
- Unit numbers: strip thousand separators, use "." for decimals, no currency symbols.
- category_code must be one of: ${categoriesList}.
- For cash balances, keep the currency exactly as shown on the statement (CHF/EUR/USD/etc.). Do not convert to USD or warn if not USD; only ensure it is a valid 3‑letter ISO 4217 code.
- For cash balances, output a 'cash' holding (quantity 1, current_unit_value = cash amount).
- For cryptocurrencies, set symbol_id to the Yahoo Finance crypto pair with "-USD" (e.g., BTC-USD, ETH-USD, XRP-USD). If only the coin code is visible, output the "-USD" pair. Set currency to USD for cryptocurrencies.
- For listed securities with a recognizable symbol (Yahoo Finance tickers, e.g., AAPL, VT, VWCE.DE), set symbol_id and you MAY set current_unit_value to null (it will be fetched).
- If a row looks like a tradable ticker (uppercase letters/numbers 1–8 chars, e.g., PLTR, NVDA, QQQ), you MUST set symbol_id to that ticker. If uncertain, set your best guess and add a warning like "symbol uncertain". Do not leave symbol_id empty for listed securities.
- cost_basis_per_unit: if an explicit "avg cost"/"average price"/"cost basis"/etc. column exists, set it; otherwise set null. It must be in the same currency as "currency".
- If multiple rows refer to the same symbol/name, prefer a single merged holding summing quantities. If cost basis differs across rows, set cost_basis_per_unit to null and add a warning.

Output guidance:
- Set success=false with a clear error if no holdings can be extracted.
- Otherwise success=true, include holdings[], and warnings[] for any low-confidence fields.
- Do NOT warn when current_unit_value is missing for rows with symbol_id; that value is fetched automatically.

Now analyze the attached file and extract the holdings.`;
}

export async function postProcessExtractedHoldings(
  obj: z.infer<typeof ExtractionResultSchema>,
): Promise<ImportResult> {
  // If no holdings extracted at all, return failure with empty holdings
  if (!obj.holdings || obj.holdings.length === 0) {
    const warnRaw = obj.warnings ?? [];
    const baseWarnings = warnRaw.map((w) =>
      typeof w === "string" ? w : w.warning,
    );
    return {
      success: false,
      holdings: [],
      warnings: baseWarnings.length ? baseWarnings : undefined,
      errors: obj.error ? [obj.error] : ["AI extraction failed"],
    };
  }

  const initial: HoldingRow[] = obj.holdings.map((h) => ({
    name: h.name,
    category_code: h.category_code,
    currency: h.currency,
    current_quantity: h.current_quantity,
    current_unit_value: h.current_unit_value ?? null,
    cost_basis_per_unit: h.cost_basis_per_unit ?? null,
    symbol_id: h.symbol_id ?? null,
    description: h.description ?? null,
  }));

  const norm = await normalizeHoldingsArray(initial);
  const { errors } = await validateHoldingsArray(norm.holdings);

  // Map raw warnings and merge with normalization warnings
  const warnRaw = obj.warnings ?? [];
  const baseWarnings = warnRaw.map((w) =>
    typeof w === "string" ? w : w.warning,
  );
  const mergedWarnings = [...baseWarnings, ...norm.warnings];

  if (errors.length > 0) {
    // Validation failed: return parsed holdings alongside errors so user can review/fix
    return {
      success: false,
      holdings: norm.holdings,
      warnings: mergedWarnings.length ? mergedWarnings : undefined,
      errors,
    };
  }

  return {
    success: true,
    holdings: norm.holdings,
    warnings: mergedWarnings.length ? mergedWarnings : undefined,
  };
}
