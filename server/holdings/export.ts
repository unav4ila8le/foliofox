"use server";

import { fetchHoldings } from "@/server/holdings/fetch";

/**
 * Export user's holdings to CSV format
 * Uses current quantity and unit value from latest records
 */
export async function exportHoldings() {
  try {
    // Fetch all holdings with current values (default behavior)
    const holdings = await fetchHoldings({
      includeArchived: false, // Only active holdings for now
    });

    // If no holdings, return empty CSV with headers
    if (holdings.length === 0) {
      const csvHeaders =
        "name,category_code,currency,current_quantity,current_unit_value,symbol_id,description\n";
      return {
        success: true,
        data: csvHeaders,
      };
    }

    // Transform holdings to CSV format
    const csvRows = holdings.map((holding) => {
      // Handle values that might contain commas or quotes
      const escapeCsvValue = (
        value: string | number | null | undefined,
      ): string => {
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      return [
        escapeCsvValue(holding.name),
        escapeCsvValue(holding.category_code),
        escapeCsvValue(holding.currency),
        escapeCsvValue(holding.current_quantity),
        escapeCsvValue(holding.current_unit_value),
        escapeCsvValue(holding.symbol_id),
        escapeCsvValue(holding.description),
      ].join(",");
    });

    // Combine headers and rows
    const csvHeaders =
      "name,category_code,currency,current_quantity,current_unit_value,symbol_id,description";
    const csvContent = [csvHeaders, ...csvRows].join("\n");

    return {
      success: true,
      data: csvContent,
    };
  } catch (error) {
    console.error("Error exporting holdings:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to export holdings",
    };
  }
}
