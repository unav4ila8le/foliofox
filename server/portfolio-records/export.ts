"use server";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";
import {
  portfolioRecordsToCSV,
  type PortfolioRecordCsvRow,
} from "@/lib/export/portfolio-records/csv";

type PortfolioRecordExportResult =
  | { success: true; data: string }
  | { success: false; message: string };

/**
 * Export all user portfolio records to CSV.
 * CSV schema matches the records import format.
 */
export async function exportPortfolioRecords(): Promise<PortfolioRecordExportResult> {
  try {
    const pageSize = 1000;
    const firstPage = await fetchPortfolioRecords({
      includeArchived: true,
      sortBy: "date",
      sortDirection: "asc",
      page: 1,
      pageSize,
    });
    const recordRows = [...firstPage.records];

    for (let page = 2; page <= firstPage.pageCount; page++) {
      const nextPage = await fetchPortfolioRecords({
        includeArchived: true,
        sortBy: "date",
        sortDirection: "asc",
        page,
        pageSize,
      });
      recordRows.push(...nextPage.records);
    }
    const csvRows: PortfolioRecordCsvRow[] = recordRows.map((record) => ({
      position_name: record.positions?.name ?? "",
      type: record.type,
      date: record.date,
      quantity: record.quantity,
      unit_value: record.unit_value,
      description: record.description,
    }));

    return {
      success: true,
      data: portfolioRecordsToCSV(csvRows),
    };
  } catch (error) {
    console.error("Error exporting portfolio records:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to export portfolio records",
    };
  }
}
