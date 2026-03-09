import type { PortfolioRecordWithPosition } from "@/types/global.types";
import type { PortfolioRecordCsvRow } from "@/lib/export/portfolio-records/csv";

export function mapPortfolioRecordToCsvRow(
  record: PortfolioRecordWithPosition,
): PortfolioRecordCsvRow {
  return {
    position_name: record.positions?.name ?? "",
    type: record.type,
    date: record.date,
    quantity: record.quantity,
    unit_value: record.unit_value,
    description: record.description,
  };
}
