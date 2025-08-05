import { fetchAssetCategories } from "@/server/asset-categories/fetch";
import { fetchCurrencies } from "@/server/currencies/fetch";

/**
 * Parse CSV content and validate it against expected holdings format
 */

// Define the expected CSV structure that matches our export format
interface CSVHoldingRow {
  name: string;
  category_code: string;
  currency: string;
  current_quantity: number;
  current_unit_value: number;
  symbol_id: string | null;
  description: string | null;
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

    // Split content into lines and remove empty lines
    const lines = csvContent
      .split("\n")
      .map((line) => line.trim())
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

    // Parse header row and clean up quotes
    const actualHeaders = headerRow
      .split(",")
      .map((h) => h.trim().replace(/"/g, ""));

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
      const values = parseCSVRow(row);

      // Check if row has correct number of columns
      if (values.length !== expectedHeaders.length) {
        return {
          success: false,
          error: `Row ${rowNumber}: Expected ${expectedHeaders.length} columns, got ${values.length}`,
        };
      }

      // Convert string values to proper types using column mapping
      const holding: CSVHoldingRow = {
        name: values[columnMap.get("name")!] || "",
        category_code: values[columnMap.get("category_code")!] || "",
        currency: values[columnMap.get("currency")!] || "",
        current_quantity:
          parseFloat(values[columnMap.get("current_quantity")!]) || 0,
        current_unit_value:
          parseFloat(values[columnMap.get("current_unit_value")!]) || 0,
        symbol_id: values[columnMap.get("symbol_id")!] || null,
        description: values[columnMap.get("description")!] || null,
      };

      // Validate all required fields
      if (!holding.name.trim()) {
        errors.push(`Row ${rowNumber}: Name is required`);
      }

      if (!holding.category_code.trim()) {
        errors.push(`Row ${rowNumber}: Category is required`);
      } else if (!supportedCategories.includes(holding.category_code)) {
        const availableCategories = supportedCategories.join(", ");
        errors.push(
          `Row ${rowNumber}: Category "${holding.category_code}" is not supported. Available categories: ${availableCategories}`,
        );
      }

      if (!holding.currency.trim()) {
        errors.push(`Row ${rowNumber}: Currency is required`);
      } else {
        if (holding.currency.length !== 3) {
          errors.push(
            `Row ${rowNumber}: Currency must be 3-character ISO 4217 code (e.g., USD, EUR, GBP)`,
          );
        } else if (
          !supportedCurrencies.includes(holding.currency.toUpperCase())
        ) {
          errors.push(
            `Row ${rowNumber}: Currency "${holding.currency}" is not supported`,
          );
        }
      }

      if (holding.current_quantity < 0) {
        errors.push(`Row ${rowNumber}: Quantity must be 0 or greater`);
      }

      if (holding.current_unit_value < 0) {
        errors.push(`Row ${rowNumber}: Unit value must be 0 or greater`);
      }

      // Add holding to results
      parsedHoldings.push(holding);
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
      error: `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Parse a single CSV row, handling quoted values with commas inside
 * @param row - Single CSV row as string
 * @returns Array of clean values
 */
function parseCSVRow(row: string): string[] {
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
    } else if (char === "," && !insideQuotes) {
      // End of value (comma outside quotes)
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
