import { parseNumberStrict } from "../parser/number-parser";

import { detectDelimiter, parseCSVRow } from "./csv";

export type RecordImportRow = {
  position_name: string; // To match the position
  type: "buy" | "sell" | "update";
  date: string;
  quantity: number;
  unit_value: number;
  description: string | null;
};

export interface RecordImportResult {
  success: boolean;
  records: RecordImportRow[];
  warnings?: string[];
  errors?: string[];
}

/**
 * Parse CSV text into portfolio records data
 * @param csvContent - Raw CSV text from uploaded file
 * @returns Parsed records data or error details
 */
export async function parseRecordsCSV(
  csvContent: string,
): Promise<RecordImportResult> {
  try {
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
        records: [],
        errors: ["CSV file must have at least a header row and one data row"],
      };
    }

    // Parse header row with the same CSV row parser (handles quotes properly)
    const headerRow = lines[0];
    const rawHeaders = parseCSVRow(headerRow, delimiter);

    // Build a simple column map for records (case-insensitive)
    const columnMap = new Map<string, number>();
    rawHeaders.forEach((header, index) => {
      const normalized = header.toLowerCase().trim();
      if (!columnMap.has(normalized)) {
        columnMap.set(normalized, index);
      }
    });

    // Required headers for portfolio records
    const requiredHeaders = [
      "position_name",
      "type",
      "date",
      "quantity",
      "unit_value",
    ] as const;

    const missingHeaders = requiredHeaders.filter(
      (header) => !columnMap.has(header),
    );

    if (missingHeaders.length > 0) {
      return {
        success: false,
        records: [],
        errors: missingHeaders.map(
          (header) => `Missing required column: ${header}`,
        ),
      };
    }

    // Pre-parse data rows
    const dataRows = lines.slice(1).map((row) => parseCSVRow(row, delimiter));

    // Parse each data row
    const parsedRecords: RecordImportRow[] = [];
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
      const dateRaw = values[columnMap.get("date")!] || "";
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

      // Validate date format (ISO: YYYY-MM-DD)
      const isValidDate =
        /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) &&
        !isNaN(new Date(dateRaw).getTime());
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

      // Build record
      const record: RecordImportRow = {
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
