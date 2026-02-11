/**
 * Portfolio Records CSV Parser
 *
 * Parses CSV/TSV files containing portfolio records (buy/sell/update transactions).
 * Handles various broker export formats through flexible header mapping.
 */

import {
  detectCSVDelimiter,
  parseCSVRowValues,
  splitCSVRecords,
} from "@/lib/import/shared/csv-parser-utils";
import { parseNumberStrict } from "@/lib/import/shared/number-parser";
import { parseUTCDateKey } from "@/lib/date/date-utils";

import {
  buildPortfolioRecordColumnMap,
  hasRequiredPortfolioRecordHeaders,
} from "./header-mapper";

import type {
  PortfolioRecordImportRow,
  PortfolioRecordImportResult,
} from "./types";

/**
 * Parse CSV text into portfolio records data
 * @param csvContent - Raw CSV text from uploaded file
 * @returns Parsed portfolio records data or error details
 */
export async function parsePortfolioRecordsCSV(
  csvContent: string,
): Promise<PortfolioRecordImportResult> {
  try {
    // Detect delimiter first
    const delimiter = detectCSVDelimiter(csvContent);

    // Split content into lines and remove empty lines
    const lines = splitCSVRecords(csvContent).filter((line) => line.length > 0);

    // Must have at least header + 1 data row
    if (lines.length < 2) {
      return {
        success: false,
        records: [],
        errors: ["CSV file must have at least a header row and one data row"],
      };
    }

    // Parse header row with the same CSV row parser (handles quotes properly)
    const headerRow = lines[0];
    const rawHeaders = parseCSVRowValues(headerRow, delimiter);

    // Build canonical column map using header mapper (supports aliases)
    const columnMap = buildPortfolioRecordColumnMap(rawHeaders);

    // Validate presence of required canonical headers
    const requiredCheck = hasRequiredPortfolioRecordHeaders(columnMap);
    if (!requiredCheck.ok) {
      return {
        success: false,
        records: [],
        errors: requiredCheck.missing.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Pre-parse data rows
    const dataRows = lines
      .slice(1)
      .map((row) => parseCSVRowValues(row, delimiter));

    // Parse each data row
    const parsedRecords: PortfolioRecordImportRow[] = [];
    const errors: string[] = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const values = dataRows[rowIndex];

      // Get required values
      const positionName = (
        values[columnMap.get("position_name")!] || ""
      ).trim();
      const typeRaw = (values[columnMap.get("type")!] || "")
        .trim()
        .toLowerCase();
      const dateRaw = (values[columnMap.get("date")!] || "").trim();
      const quantityRaw = values[columnMap.get("quantity")!] || "";
      const unitValueRaw = values[columnMap.get("unit_value")!] || "";

      // Optional description
      const descriptionRaw = columnMap.has("description")
        ? values[columnMap.get("description")!]
        : "";

      // Validate type
      if (!["buy", "sell", "update"].includes(typeRaw)) {
        errors.push(
          `Row ${rowIndex + 2}: Invalid type "${typeRaw}". Must be buy, sell, or update.`,
        );
        continue;
      }

      // Parse numbers
      const quantity = parseNumberStrict(quantityRaw);
      const unitValue = parseNumberStrict(unitValueRaw);

      // Validate parsed numbers
      if (isNaN(quantity)) {
        errors.push(`Row ${rowIndex + 2}: Invalid quantity "${quantityRaw}"`);
        continue;
      }

      if (isNaN(unitValue)) {
        errors.push(
          `Row ${rowIndex + 2}: Invalid unit_value "${unitValueRaw}"`,
        );
        continue;
      }

      if (!positionName) {
        errors.push(`Row ${rowIndex + 2}: Missing position name`);
        continue;
      }

      if (!dateRaw) {
        errors.push(`Row ${rowIndex + 2}: Missing date`);
        continue;
      }

      // Validate strict date format and calendar validity (YYYY-MM-DD).
      // Reject overflow dates like 2026-02-31 instead of normalizing them.
      const parsedDate = parseUTCDateKey(dateRaw);
      const isValidDate = !isNaN(parsedDate.getTime());
      if (!isValidDate) {
        errors.push(
          `Row ${rowIndex + 2}: Invalid date "${dateRaw}". Use YYYY-MM-DD format.`,
        );
        continue;
      }

      // Validate non-negative values
      if (quantity < 0) {
        errors.push(`Row ${rowIndex + 2}: Quantity cannot be negative`);
        continue;
      }

      if (unitValue < 0) {
        errors.push(`Row ${rowIndex + 2}: Unit value cannot be negative`);
        continue;
      }

      // Build portfolio record
      const record: PortfolioRecordImportRow = {
        position_name: positionName,
        type: typeRaw as "buy" | "sell" | "update",
        date: dateRaw,
        quantity,
        unit_value: unitValue,
        description: descriptionRaw || null,
      };

      parsedRecords.push(record);
    }

    if (errors.length > 0) {
      return {
        success: false,
        records: parsedRecords,
        errors,
      };
    }

    return {
      success: true,
      records: parsedRecords,
    };
  } catch (error) {
    console.error("Unexpected error during CSV parsing:", error);
    return {
      success: false,
      records: [],
      errors: [
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }
}
