import {
  buildCanonicalColumnMap,
  hasRequiredHeaders,
} from "../parser/header-mapper";
import { mapCategory } from "../parser/category-mapper";
import { parseNumberStrict } from "../parser/number-parser";
import {
  normalizePositionsArray,
  validatePositionsArray,
} from "../parser/validation";

import { fetchCurrencies } from "@/server/currencies/fetch";

import type { PositionImportRow, PositionImportResult } from "../types";

/**
 * Detect the delimiter used in the file by scoring the first line.
 * @param content - Raw CSV/TSV text
 * @returns the detected delimiter: "," | "\t" | ";" (defaulting to ",")
 */
export function detectDelimiter(content: string): string {
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
export function parseCSVRow(row: string, delimiter: string): string[] {
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
 * @param currentCategory - Current canonical category id
 * @param name - Position name (used for "cash" hint)
 * @param symbolLookup - Symbol (if present, we assume equity)
 * @returns Canonical category code
 */
function inferCategoryIfMissing(
  currentCategory: string,
  name: string,
  symbolLookup: string | null,
): string {
  if (currentCategory && currentCategory !== "other") return currentCategory;

  const lowerName = name.toLowerCase();
  if (lowerName.includes("cash")) return "cash";
  if (symbolLookup && symbolLookup.trim() !== "") return "equity";
  if (lowerName.includes("domain") || lowerName.includes(".com"))
    return "domain";
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
 * @returns Parsed positions data or error details
 */
export async function parsePositionsCSV(
  csvContent: string,
): Promise<PositionImportResult> {
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
        positions: [],
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
        positions: [],
        errors: requiredCheck.missing.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Parse each data row - continue even if headers are wrong to find all issues at once
    const parsedPositions: PositionImportRow[] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const values = dataRows[rowIndex];

      // Safe reads for optional columns
      const categoryRaw = columnMap.has("category_id")
        ? values[columnMap.get("category_id")!]
        : "";
      const currencyRaw = columnMap.has("currency")
        ? values[columnMap.get("currency")!]
        : "";
      const symbolRaw = columnMap.has("symbol_lookup")
        ? values[columnMap.get("symbol_lookup")!]
        : "";
      const descriptionRaw = columnMap.has("description")
        ? values[columnMap.get("description")!]
        : "";

      // Name fallback: prefer name; else description; else symbol
      let nameValue = values[columnMap.get("name")!] || "";
      if (!nameValue) nameValue = descriptionRaw || symbolRaw || "";

      // Optional unit value (may be missing if symbol is present)
      const unitRaw = columnMap.has("unit_value")
        ? values[columnMap.get("unit_value")!]
        : "";
      const parsedUnitValue = parseNumberStrict(unitRaw);

      // Optional cost basis per unit
      const costBasisRaw = columnMap.has("cost_basis_per_unit")
        ? values[columnMap.get("cost_basis_per_unit")!]
        : "";
      const parsedCostBasis = parseNumberStrict(costBasisRaw);

      // Build position
      const position: PositionImportRow = {
        name: nameValue,
        category_id: mapCategory(categoryRaw),
        currency: (currencyRaw || "").trim().toUpperCase(),
        quantity: parseNumberStrict(values[columnMap.get("quantity")!]),
        unit_value: isNaN(parsedUnitValue) ? null : parsedUnitValue,
        cost_basis_per_unit: isNaN(parsedCostBasis) ? null : parsedCostBasis,
        symbolLookup: symbolRaw || null,
        description: descriptionRaw || null,
      };

      // Infer category if missing from name or symbol
      position.category_id = inferCategoryIfMissing(
        position.category_id,
        position.name,
        position.symbolLookup,
      );

      // Add position to results
      parsedPositions.push(position);
    }

    // Normalize positions using shared helper (adjust currency/symbol)
    const {
      positions: normalizedPositions,
      warnings,
      symbolValidationResults,
    } = await normalizePositionsArray(parsedPositions);

    // Run shared validation
    const { errors: validationErrors } = await validatePositionsArray(
      normalizedPositions,
      symbolValidationResults,
    );

    // Convert Map to Record for JSON-friendly shape
    const symbolValidation = symbolValidationResults
      ? Object.fromEntries(symbolValidationResults)
      : undefined;

    if (validationErrors.length > 0) {
      // Validation failed: return parsed positions alongside errors so user can review/fix
      return {
        success: false,
        positions: normalizedPositions,
        warnings: warnings && warnings.length ? warnings : undefined,
        errors: validationErrors,
        symbolValidation,
        supportedCurrencies,
      };
    }

    return {
      success: true,
      positions: normalizedPositions,
      warnings: warnings && warnings.length ? warnings : undefined,
      symbolValidation,
      supportedCurrencies,
    };
  } catch (error) {
    console.error("Unexpected error during CSV parsing:", error);
    return {
      success: false,
      positions: [],
      errors: [
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      ], // Array instead of string
    };
  }
}
