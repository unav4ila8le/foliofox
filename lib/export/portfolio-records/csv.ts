export interface PortfolioRecordCsvRow {
  position_name: string;
  type: string;
  date: string;
  quantity: number;
  unit_value: number;
  description: string | null;
}

const PORTFOLIO_RECORD_CSV_HEADERS = [
  "position_name",
  "type",
  "date",
  "quantity",
  "unit_value",
  "description",
] as const;

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function portfolioRecordsToCSV(rows: PortfolioRecordCsvRow[]): string {
  const serializedRows = rows.map((row) =>
    [
      escapeCsvValue(row.position_name),
      escapeCsvValue(row.type),
      escapeCsvValue(row.date),
      escapeCsvValue(row.quantity),
      escapeCsvValue(row.unit_value),
      escapeCsvValue(row.description),
    ].join(","),
  );

  return [PORTFOLIO_RECORD_CSV_HEADERS.join(","), ...serializedRows].join("\n");
}
