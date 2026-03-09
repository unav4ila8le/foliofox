"use server";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";
import { portfolioRecordsToCSV } from "@/lib/export/portfolio-records/csv";
import { mapPortfolioRecordToCsvRow } from "@/lib/export/portfolio-records/map-record-to-csv";

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
    const csvRows = recordRows.map(mapPortfolioRecordToCsvRow);

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
