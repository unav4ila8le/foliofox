import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { validateSymbolsBatch } from "@/server/symbols/validate";

import type { CSVHoldingRow } from "@/lib/csv-parser";

// Zod schema matching existing CSVHoldingRow interface
// Allow current_unit_value to be optional since it can be NaN for symbol holdings
const HoldingSchema = z.object({
  name: z.string().describe("Name of the holding or investment"),
  category_code: z
    .enum([
      "cash",
      "equity",
      "fixed_income",
      "real_estate",
      "cryptocurrency",
      "commodities",
      "other",
    ])
    .describe("Asset category code"),
  currency: z
    .string()
    .length(3)
    .describe("3-letter currency code (e.g., USD, EUR)"),
  current_quantity: z.number().min(0).describe("Number of units/shares held"),
  current_unit_value: z
    .number()
    .nullable()
    .optional()
    .describe("Price per unit/share (optional if symbol_id is provided)"),
  cost_basis_per_unit: z
    .number()
    .nullable()
    .optional()
    .describe("Cost basis per unit (optional)"),
  symbol_id: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Stock ticker or symbol, must use Yahoo Finance ticker symbols (if applicable)",
    ),
  description: z
    .string()
    .nullable()
    .optional()
    .describe("Additional notes or description"),
});

const WarningSchema = z.union([z.string(), z.object({ warning: z.string() })]);

const ExtractionResultSchema = z.object({
  success: z.boolean(),
  holdings: z.array(HoldingSchema).optional(),
  error: z.string().nullable().optional(),
  warnings: z
    .array(WarningSchema)
    .nullable()
    .optional()
    .describe("Non-fatal issues or unclear data points"),
});

// Allow processing up to 30 seconds (same as chat route)
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json(
        { success: false, error: "No files provided" },
        { status: 400 },
      );
    }

    // For now, handle single file (we can extend to multiple files later)
    const file = files[0];

    if (!file.url) {
      return Response.json(
        { success: false, error: "File URL is required" },
        { status: 400 },
      );
    }

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a precise financial document parser. Extract ONLY portfolio holdings/positions, not transactions, totals, or P/L.

Return data that strictly matches the provided JSON schema. Do not invent values:
- If a field is unreadable or not present, set it to null and add a helpful warning in "warnings".
- Currency must be a 3-letter ISO 4217 code in uppercase (e.g., USD, EUR, CHF). Do not include symbols.
- When symbol_id is present, set currency to the symbol’s native trading currency from Yahoo Finance, never the page’s base/portfolio currency.
- Quantity can be fractional, must be >= 0.
- Unit numbers: strip thousand separators, use "." for decimals, no currency symbols.
- category_code must be one of: cash, equity, fixed_income, real_estate, cryptocurrency, commodities, other.
- For cash balances, output a 'cash' holding (quantity 1, current_unit_value = cash amount).
- For listed securities with a recognizable symbol (Yahoo Finance tickers, e.g., AAPL, VT, VWCE.DE), set symbol_id and you MAY set current_unit_value to null (it will be fetched).
- cost_basis_per_unit: if an explicit "avg cost"/"average price"/"cost basis" column exists, set it; otherwise set null. It must be in the same currency as "currency".
- If multiple rows refer to the same symbol/name, prefer a single merged holding summing quantities. If cost basis differs across rows, set cost_basis_per_unit to null and add a warning.

Output guidance:
- Set success=false with a clear error if no holdings can be extracted.
- Otherwise success=true, include holdings[], and warnings[] for any low-confidence fields.

Now analyze the attached file and extract the holdings.`,
            },
            {
              type: "file",
              data: file.url,
              mediaType: file.mediaType,
            },
          ],
        },
      ],
      schema: ExtractionResultSchema,
    });

    // Convert AI result and normalize currencies for symbols using Yahoo Finance metadata
    if (result.object.success && result.object.holdings) {
      const convertedHoldings: CSVHoldingRow[] = result.object.holdings.map(
        (holding) => ({
          name: holding.name,
          category_code: holding.category_code,
          currency: holding.currency,
          current_quantity: holding.current_quantity,
          current_unit_value: holding.current_unit_value ?? null,
          cost_basis_per_unit: holding.cost_basis_per_unit ?? null,
          symbol_id: holding.symbol_id ?? null,
          description: holding.description ?? null,
        }),
      );

      // Batch-validate symbols to ensure currency correctness
      const symbolIds = convertedHoldings
        .map((h) => (h.symbol_id ? h.symbol_id.trim() : ""))
        .filter((s) => s.length > 0);

      const normalizationWarnings: string[] = [];
      if (symbolIds.length > 0) {
        const validation = await validateSymbolsBatch(symbolIds);

        convertedHoldings.forEach((h) => {
          if (!h.symbol_id) return;
          const v = validation.results.get(h.symbol_id);
          if (!v) return;

          // If the symbol library provides a currency, prefer it
          if (v.currency && h.currency !== v.currency) {
            normalizationWarnings.push(
              `Adjusted currency for ${h.symbol_id} from ${h.currency} to ${v.currency}`,
            );
            h.currency = v.currency;
          }

          // If a normalized symbol exists, update it (e.g., trimmed/uppercased)
          if (v.normalized && v.normalized !== h.symbol_id) {
            normalizationWarnings.push(
              `Normalized symbol ${h.symbol_id} to ${v.normalized}`,
            );
            h.symbol_id = v.normalized;
          }
        });
      }

      const err = result.object.error ?? undefined;
      const warnRaw = result.object.warnings ?? [];
      const warnStrings = warnRaw
        .map((w) => (typeof w === "string" ? w : w.warning))
        .filter(Boolean) as string[];
      const warn = [...warnStrings, ...normalizationWarnings];

      return Response.json({
        success: true,
        holdings: convertedHoldings,
        warnings: warn,
        error: err,
      });
    }

    return Response.json(result.object);
  } catch (error) {
    console.error("AI extraction error:", error);
    return Response.json(
      {
        success: false,
        error:
          "Failed to process document. Please try again or use a different file format.",
      },
      { status: 500 },
    );
  }
}
