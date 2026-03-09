import { escapeCsvCell } from "@/lib/shared/csv";

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

export function portfolioRecordsToCSV(rows: PortfolioRecordCsvRow[]): string {
  const serializedRows = rows.map((row) =>
    [
      escapeCsvCell(row.position_name),
      escapeCsvCell(row.type),
      escapeCsvCell(row.date),
      escapeCsvCell(row.quantity),
      escapeCsvCell(row.unit_value),
      escapeCsvCell(row.description),
    ].join(","),
  );

  return [PORTFOLIO_RECORD_CSV_HEADERS.join(","), ...serializedRows].join("\n");
}
