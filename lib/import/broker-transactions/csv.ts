import {
  detectCSVDelimiter,
  parseCSVRowValues,
  splitCSVRecords,
} from "@/lib/import/shared/csv-parser-utils";

import type {
  BrokerTransactionCSVRow,
  BrokerTransactionCSVTable,
} from "./types";

export function normalizeBrokerHeader(rawHeader: string): string {
  return rawHeader
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/"/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function buildRow(
  values: string[],
  normalizedHeaders: string[],
  rowNumber: number,
): BrokerTransactionCSVRow {
  const indexByHeader = new Map<string, number>();
  normalizedHeaders.forEach((header, index) => {
    if (!indexByHeader.has(header)) {
      indexByHeader.set(header, index);
    }
  });

  return {
    rowNumber,
    values,
    get: (header: string) => {
      const index = indexByHeader.get(normalizeBrokerHeader(header));
      return index === undefined ? "" : (values[index] ?? "");
    },
  };
}

export function parseBrokerTransactionCSVTable(csvContent: string):
  | { success: true; table: BrokerTransactionCSVTable }
  | {
      success: false;
      errors: string[];
    } {
  const delimiter = detectCSVDelimiter(csvContent);
  const records = splitCSVRecords(csvContent).filter((line) => line.length > 0);

  if (records.length < 2) {
    return {
      success: false,
      errors: ["CSV file must have at least a header row and one data row"],
    };
  }

  const headers = parseCSVRowValues(records[0], delimiter);
  const normalizedHeaders = headers.map(normalizeBrokerHeader);

  // Broker adapters use normalized headers so future exports can vary casing
  // or whitespace without changing each adapter's detection code.
  const rows = records
    .slice(1)
    .map((record, index) =>
      buildRow(
        parseCSVRowValues(record, delimiter),
        normalizedHeaders,
        index + 2,
      ),
    );

  return {
    success: true,
    table: {
      headers,
      normalizedHeaders,
      rows,
    },
  };
}
