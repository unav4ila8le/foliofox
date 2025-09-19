"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { createHolding } from "@/server/holdings/create";

import { parseHoldingsCSV } from "@/lib/import/sources/csv";

import type { ImportActionResult } from "@/lib/import/types";

// Helper function to check for duplicate holding names in batch
async function checkForDuplicateNames(holdingNames: string[]) {
  const { supabase, user } = await getCurrentUser();

  const { data, error } = await supabase
    .from("holdings")
    .select("name")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .in("name", holdingNames);

  if (error) {
    throw new Error(`Failed to check for duplicate names: ${error.message}`);
  }

  return data?.map((holding) => holding.name) || [];
}

/**
 * Import holdings from CSV content
 * All-or-nothing approach: if any holding fails, entire import fails
 */
export async function importHoldings(
  csvContent: string,
): Promise<ImportActionResult> {
  try {
    // First, parse and validate the CSV
    const parseResult = await parseHoldingsCSV(csvContent);

    if (!parseResult.success) {
      return {
        success: false,
        error: (parseResult.errors ?? ["Failed to parse CSV"]).join("\n"),
      };
    }

    const holdings = parseResult.holdings!;

    // Check for duplicate names upfront - abort if any exist
    const holdingNames = holdings.map((holding) => holding.name);
    const duplicateNames = await checkForDuplicateNames(holdingNames);

    if (duplicateNames.length > 0) {
      const duplicateList = duplicateNames.join(", ");
      return {
        success: false,
        error: `Cannot import: the following holding name(s) already exist: ${duplicateList}. Please rename these holdings in your CSV file and try again.`,
      };
    }

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

      // Ensure we have a finite unit value before proceeding
      if (
        unitValue == null ||
        typeof unitValue !== "number" ||
        Number.isNaN(unitValue)
      ) {
        return {
          success: false,
          error: `Missing unit value for "${holding.name}". Provide current_unit_value in CSV or use a recognizable symbol to fetch price automatically.`,
        };
      }

      // Create FormData for the existing createHolding function
      const formData = new FormData();
      formData.append("name", holding.name);
      formData.append("category_code", holding.category_code);
      formData.append("currency", holding.currency);
      formData.append("quantity", holding.current_quantity.toString());
      formData.append("unit_value", unitValue?.toString() || "");
      formData.append(
        "cost_basis_per_unit",
        holding.cost_basis_per_unit?.toString() || "",
      );
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
