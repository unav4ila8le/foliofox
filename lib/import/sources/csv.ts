import {
  buildCanonicalColumnMap,
  hasRequiredHeaders,
} from "../parser/header-mapper";
import { mapCategory } from "../parser/category-mapper";
import { parseNumberStrict } from "../parser/number-parser";
import {
  normalizeHoldingsArray,
  validateHoldingsArray,
} from "../parser/validation";

import { fetchCurrencies } from "@/server/currencies/fetch";

import type { HoldingRow, ImportResult } from "../types";

/**
 * Detect the delimiter used in the file by scoring the first line.
 * @param content - Raw CSV/TSV text
 * @returns the detected delimiter: "," | "\t" | ";" (defaulting to ",")
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split("\n")[0];

  const counts = {
    comma: (firstLine.match(/,/g) || []).length,
    tab: (firstLine.match(/\t/g) || []).length,
    semicolon: (firstLine.match(/;/g) || []).length,
  };

  // Determine the highest count
  const maxCount = Math.max(counts.comma, counts.tab, counts.semicolon);

  if (maxCount === 0) return ","; // Default fallback

  if (counts.tab === maxCount) return "\t";
  if (counts.semicolon === maxCount) return ";";
  return ",";
}

/**
 * Parse a single CSV row, handling quoted values and embedded delimiters.
 * @param row - A single CSV line
 * @param delimiter - The delimiter to split by
 * @returns Clean string values preserving quoted content
 */
function parseCSVRow(row: string, delimiter: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (insideQuotes && row[i + 1] === '"') {
        // Handle escaped quotes ("" becomes ")
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state (entering or leaving quotes)
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      // End of value (delimiter outside quotes)
      values.push(currentValue.trim());
      currentValue = "";
    } else {
      // Regular character, add to current value
      currentValue += char;
    }
  }

  // Don't forget the last value
  values.push(currentValue.trim());

  return values;
}

/**
 * Infer category only when mapping returned "other".
 * @param currentCategory - Current canonical category code
 * @param name - Holding name (used for "cash" hint)
 * @param symbolId - Symbol (if present, we assume equity)
 * @returns Canonical category code
 */
function inferCategoryIfMissing(
  currentCategory: string,
  name: string,
  symbolId: string | null,
): string {
  if (currentCategory && currentCategory !== "other") return currentCategory;

  const lowerName = name.toLowerCase();
  if (lowerName.includes("cash")) return "cash";
  if (symbolId && symbolId.trim() !== "") return "equity";
  return "other";
}

/**
 * Try to guess which column holds ISO currency codes when header isn't mapped.
 * Looks across the first N rows and finds a column where most non-empty cells
 * are 3-letter codes present in supportedCurrencies.
 */
function inferCurrencyColumnIndex(
  dataRows: string[][],
  supportedCurrencies: string[],
  sampleSize = 50,
): number | undefined {
  const rowsToSample = dataRows.slice(0, sampleSize);
  if (rowsToSample.length === 0) return undefined;

  const maxCols = Math.max(...rowsToSample.map((r) => r.length));
  let bestIndex: number | undefined;
  let bestScore = 0;

  for (let col = 0; col < maxCols; col++) {
    let hits = 0;
    let nonEmpty = 0;

    for (const row of rowsToSample) {
      const cell = (row[col] ?? "").trim().replace(/"/g, "");
      if (!cell) continue;
      nonEmpty++;
      if (
        cell.length === 3 &&
        supportedCurrencies.includes(cell.toUpperCase())
      ) {
        hits++;
      }
    }

    const score = nonEmpty > 0 ? hits / nonEmpty : 0;
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestIndex = col;
    }
  }

  return bestIndex;
}

/**
 * Parse CSV text into structured data
 * @param csvContent - Raw CSV text from uploaded file
 * @returns Parsed holdings data or error details
 */
export async function parseHoldingsCSV(
  csvContent: string,
): Promise<ImportResult> {
  try {
    // Get supported currencies and extract just the codes
    const currencies = await fetchCurrencies();
    const supportedCurrencies = currencies.map((c) => c.alphabetic_code);

    // Detect delimiter first
    const delimiter = detectDelimiter(csvContent);

    // Split content into lines and remove empty lines
    const lines = csvContent
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.length > 0);

    // Must have at least header + 1 data row
    if (lines.length < 2) {
      return {
        success: false,
        holdings: [],
        errors: ["CSV file must have at least a header row and one data row"],
      };
    }

    // Parse header row with the same CSV row parser (handles quotes properly)
    const headerRow = lines[0];
    const rawHeaders = parseCSVRow(headerRow, delimiter);

    // Build canonical header → index map (extra/unknown columns ignored)
    const columnMap = buildCanonicalColumnMap(rawHeaders);

    // Pre-parse data rows once (we need them for currency inference too)
    const dataRows = lines.slice(1).map((row) => parseCSVRow(row, delimiter));

    // If no explicit currency header, try to infer the column index
    if (!columnMap.has("currency")) {
      const inferredIndex = inferCurrencyColumnIndex(
        dataRows,
        supportedCurrencies,
      );
      if (inferredIndex !== undefined) {
        columnMap.set("currency", inferredIndex);
      }
    }

    // Validate presence of required canonical headers
    const requiredCheck = hasRequiredHeaders(columnMap);
    if (!requiredCheck.ok) {
      return {
        success: false,
        holdings: [],
        errors: requiredCheck.missing.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Parse each data row - continue even if headers are wrong to find all issues at once
    const parsedHoldings: HoldingRow[] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const values = dataRows[rowIndex];

      // Safe reads for optional columns
      const categoryRaw = columnMap.has("category_code")
        ? values[columnMap.get("category_code")!]
        : "";
      const currencyRaw = columnMap.has("currency")
        ? values[columnMap.get("currency")!]
        : "";
      const symbolRaw = columnMap.has("symbol_id")
        ? values[columnMap.get("symbol_id")!]
        : "";
      const descriptionRaw = columnMap.has("description")
        ? values[columnMap.get("description")!]
        : "";

      // Name fallback: prefer name; else description; else symbol
      let nameValue = values[columnMap.get("name")!] || "";
      if (!nameValue) nameValue = descriptionRaw || symbolRaw || "";

      // Optional unit value (may be missing if symbol is present)
      const unitRaw = columnMap.has("current_unit_value")
        ? values[columnMap.get("current_unit_value")!]
        : "";
      const parsedUnitValue = parseNumberStrict(unitRaw);

      // Optional cost basis per unit
      const costBasisRaw = columnMap.has("cost_basis_per_unit")
        ? values[columnMap.get("cost_basis_per_unit")!]
        : "";
      const parsedCostBasis = parseNumberStrict(costBasisRaw);

      // Build holding
      const holding: HoldingRow = {
        name: nameValue,
        category_code: mapCategory(categoryRaw),
        currency: (currencyRaw || "").trim().toUpperCase(),
        current_quantity: parseNumberStrict(
          values[columnMap.get("current_quantity")!],
        ),
        current_unit_value: isNaN(parsedUnitValue) ? null : parsedUnitValue,
        cost_basis_per_unit: isNaN(parsedCostBasis) ? null : parsedCostBasis,
        symbol_id: symbolRaw || null,
        description: descriptionRaw || null,
      };

      // Infer category if missing from name or symbol
      holding.category_code = inferCategoryIfMissing(
        holding.category_code,
        holding.name,
        holding.symbol_id,
      );

      // Add holding to results
      parsedHoldings.push(holding);
    }

    // Normalize holdings using shared helper (adjust currency/symbol)
    const { holdings: normalized, warnings } =
      await normalizeHoldingsArray(parsedHoldings);

    // Run shared validation (same path as AI import)
    const { errors: validationErrors } =
      await validateHoldingsArray(normalized);

    if (validationErrors.length > 0) {
      // Validation failed: return parsed holdings alongside errors so user can review/fix
      return {
        success: false,
        holdings: normalized,
        warnings: warnings && warnings.length ? warnings : undefined,
        errors: validationErrors,
      };
    }

    return { success: true, holdings: normalized, warnings };
  } catch (error) {
    console.error("Unexpected error during CSV parsing:", error);
    return {
      success: false,
      holdings: [],
      errors: [
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      ], // Array instead of string
    };
  }
}
