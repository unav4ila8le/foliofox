"use server";

import { revalidatePath } from "next/cache";

import { parseHoldingsCSV } from "@/lib/csv-parser";
import { createSymbol } from "@/server/symbols/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { createHolding } from "@/server/holdings/create";

/**
 * Import holdings from CSV content
 * All-or-nothing approach: if any holding fails, entire import fails
 */
export async function importHoldings(csvContent: string) {
  try {
    // First, parse and validate the CSV
    const parseResult = await parseHoldingsCSV(csvContent);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    const holdings = parseResult.data!;

    // Import each holding one by one
    for (let i = 0; i < holdings.length; i++) {
      const holding = holdings[i];

      // For holdings with symbols, fetch current market price
      let unitValue = holding.current_unit_value;
      if (holding.symbol_id && holding.symbol_id.trim() !== "") {
        try {
          // 1. Create symbol first (this ensures it exists in the database)
          const symbolResult = await createSymbol(holding.symbol_id);
          if (!symbolResult.success) {
            return {
              success: false,
              error: `Failed to create symbol ${holding.symbol_id}: ${symbolResult.message}`,
            };
          }

          // 2. Now fetch the current market price
          unitValue = await fetchSingleQuote(holding.symbol_id);
        } catch (error) {
          console.error(
            `Failed to fetch quote for ${holding.symbol_id}:`,
            error,
          );
          // Fall back to CSV value if quote fetch fails
        }
      }

      // Create FormData for the existing createHolding function
      const formData = new FormData();
      formData.append("name", holding.name);
      formData.append("category_code", holding.category_code);
      formData.append("currency", holding.currency);
      formData.append("quantity", holding.current_quantity.toString());
      formData.append("unit_value", unitValue.toString());
      formData.append("symbol_id", holding.symbol_id || "");
      formData.append("description", holding.description || "");

      // Use existing createHolding function
      const result = await createHolding(formData);

      if (!result.success) {
        return {
          success: false,
          error: `Failed to import "${holding.name}": ${result.message}`,
        };
      }
    }

    // Success
    revalidatePath("/dashboard", "layout");

    return {
      success: true,
      importedCount: holdings.length,
    };
  } catch (error) {
    console.error("Import error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to import holdings",
    };
  }
}
