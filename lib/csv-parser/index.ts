import { mapCategory } from "./category-mapper";
import { validateHolding, validateSymbolCurrency } from "./validation";

import { fetchAssetCategories } from "@/server/asset-categories/fetch";
import { fetchCurrencies } from "@/server/currencies/fetch";
import { validateSymbolsBatch } from "@/server/symbols/validate";

/**
 * Parse CSV content and validate it against expected holdings format
 */

// Define and export the expected CSV structure that matches our export format
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
 * Detect the delimiter used in the file (comma, tab, or semicolon).
 * @param content - File content to analyze
 * @returns The detected delimiter
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
        error: "CSV file must have at least a header row and one data row",
      };
    }

    // Extract and validate header row
    const headerRow = lines[0];
    const expectedHeaders = [
      "name",
      "category_code",
      "currency",
      "current_quantity",
      "current_unit_value",
      "symbol_id",
      "description",
    ];

    // Parse header row and clean up quotes, convert to lowercase
    const actualHeaders = headerRow
      .split(delimiter)
      .map((h) => h.trim().replace(/"/g, "").toLowerCase());

    // Check if all required columns are present
    const missingHeaders = expectedHeaders.filter(
      (expected) => !actualHeaders.includes(expected),
    );

    if (missingHeaders.length > 0) {
      return {
        success: false,
        errors: missingHeaders.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Create column mapping
    const columnMap = new Map<string, number>();
    actualHeaders.forEach((header, index) => {
      columnMap.set(header, index);
    });

    // Parse each data row - continue even if headers are wrong to find all issues at once
    const dataRows = lines.slice(1); // Skip header row
    const parsedHoldings: CSVHoldingRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because we skip header and arrays start at 0

      // Parse CSV row (handles quoted values with commas inside)
      const values = parseCSVRow(row, delimiter);

      // Check if row has correct number of columns
      if (values.length !== expectedHeaders.length) {
        return {
          success: false,
          errors: [
            `Row ${rowNumber}: Expected ${expectedHeaders.length} columns, got ${values.length}`,
          ],
        };
      }

      // Convert string values to proper types using column mapping
      const holding: CSVHoldingRow = {
        name: values[columnMap.get("name")!] || "",
        category_code: mapCategory(values[columnMap.get("category_code")!]),
        currency: (values[columnMap.get("currency")!] || "").toUpperCase(),
        current_quantity: parseFloat(
          values[columnMap.get("current_quantity")!],
        ),
        current_unit_value: parseFloat(
          values[columnMap.get("current_unit_value")!],
        ),
        symbol_id: values[columnMap.get("symbol_id")!] || null,
        description: values[columnMap.get("description")!] || null,
      };

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

/**
 * Parse a single CSV row, handling quoted values with commas inside
 * @param row - Single CSV row as string
 * @param delimiter - The delimiter to use
 * @returns Array of clean values
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
