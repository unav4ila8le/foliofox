import { buildCanonicalColumnMap, hasRequiredHeaders } from "./header-mapper";
import { mapCategory } from "./category-mapper";
import { parseNumberStrict } from "./number-parser";
import { validateHolding, validateSymbolCurrency } from "./validation";

import { fetchAssetCategories } from "@/server/asset-categories/fetch";
import { fetchCurrencies } from "@/server/currencies/fetch";
import { validateSymbolsBatch } from "@/server/symbols/validate";

/**
 * Parse CSV content and validate it against expected holdings format
 */

// Define and export the expected CSV structure (canonical)
export interface CSVHoldingRow {
  name: string;
  category_code: string;
  currency: string;
  current_quantity: number;
  current_unit_value: number;
  symbol_id: string | null;
  description: string | null;
}

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
  rawHeaders: string[],
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
export async function parseHoldingsCSV(csvContent: string) {
  try {
    // Initialize errors array
    const errors: string[] = [];

    // Get supported currencies and extract just the codes
    const currencies = await fetchCurrencies();
    const supportedCurrencies = currencies.map((c) => c.alphabetic_code);

    // Get supported asset categories and extract just the codes
    const categories = await fetchAssetCategories();
    const supportedCategories = categories.map((c) => c.code);

    // Create context for validation
    const validationContext = {
      supportedCategories,
      supportedCurrencies,
    };

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
        rawHeaders,
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
        errors: requiredCheck.missing.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Parse each data row - continue even if headers are wrong to find all issues at once
    const parsedHoldings: CSVHoldingRow[] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const rowNumber = rowIndex + 2; // +2 because we skip header and arrays start at 0
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

      // Build holding
      const holding: CSVHoldingRow = {
        name: nameValue,
        category_code: mapCategory(categoryRaw),
        currency: (currencyRaw || "").trim().toUpperCase(),
        current_quantity: parseNumberStrict(
          values[columnMap.get("current_quantity")!],
        ),
        current_unit_value: parsedUnitValue,
        symbol_id: symbolRaw || null,
        description: descriptionRaw || null,
      };

      // Infer category if missing from name or symbol
      holding.category_code = inferCategoryIfMissing(
        holding.category_code,
        holding.name,
        holding.symbol_id,
      );

      // Validate all required fields
      const validationErrors = validateHolding(
        holding,
        rowNumber,
        validationContext,
      );
      errors.push(...validationErrors);

      // Add holding to results
      parsedHoldings.push(holding);
    }

    // Validate symbols if any are provided
    const symbolsToValidate = parsedHoldings
      .map((h) => h.symbol_id)
      .filter((s) => s && s.trim() !== "") as string[];

    if (symbolsToValidate.length > 0) {
      const symbolValidation = await validateSymbolsBatch(symbolsToValidate);

      if (!symbolValidation.valid) {
        // Add symbol validation errors to the errors array
        symbolValidation.errors.forEach((error) => errors.push(error));
      }

      // Update normalized symbols in the parsed holdings
      parsedHoldings.forEach((holding) => {
        if (holding.symbol_id) {
          const validation = symbolValidation.results.get(holding.symbol_id);
          if (validation?.valid && validation.normalized) {
            holding.symbol_id = validation.normalized;
          }
        }
      });

      // Validate that symbol currencies match CSV currencies
      parsedHoldings.forEach((holding, index) => {
        if (holding.symbol_id) {
          const validation = symbolValidation.results.get(holding.symbol_id);
          if (validation?.valid && validation.currency) {
            const currencyErrors = validateSymbolCurrency(
              holding,
              index + 2,
              validation.currency,
            );
            errors.push(...currencyErrors);
          }
        }
      });
    }

    // Return all errors if any exist
    if (errors.length > 0) {
      return {
        success: false,
        errors: errors, // Return array of errors for better display
      };
    }

    return {
      success: true,
      data: parsedHoldings,
    };
  } catch (error) {
    console.error("Unexpected error during CSV parsing:", error);
    return {
      success: false,
      errors: [
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      ], // Array instead of string
    };
  }
}
