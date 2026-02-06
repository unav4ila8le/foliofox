"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createSymbol } from "@/server/symbols/create";
import { resolveSymbolInput } from "@/server/symbols/resolve";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { createPosition } from "@/server/positions/create";

import { normalizeCapitalGainsTaxRateToDecimal } from "@/lib/capital-gains-tax-rate";
import { parsePositionsCSV } from "@/lib/import/positions/parse-csv";

import type { ImportActionResult } from "@/lib/import/shared/types";

export async function importPositionsFromCSV(
  csvContent: string,
  positionType: "asset" | "liability" = "asset",
): Promise<ImportActionResult> {
  try {
    if (positionType !== "asset") {
      return {
        success: false,
        error: "Only asset imports are supported right now",
      };
    }

    // 1) Parse and validate CSV (shared logic)
    const parsed = await parsePositionsCSV(csvContent);
    if (!parsed.success) {
      return {
        success: false,
        error: (parsed.errors ?? ["Failed to parse CSV"]).join("\n"),
      };
    }
    const rows = parsed.positions;

    // 2) Check duplicate names in positions
    const { supabase, user } = await getCurrentUser();
    const names = rows.map((p) => p.name);
    const { data: existing, error: dupErr } = await supabase
      .from("positions")
      .select("name")
      .eq("user_id", user.id)
      .eq("type", "asset")
      .is("archived_at", null)
      .in("name", names);

    if (dupErr) {
      return {
        success: false,
        error: `Failed duplicate check: ${dupErr.message}`,
      };
    }
    if (existing && existing.length > 0) {
      const list = existing.map((e) => e.name).join(", ");
      return {
        success: false,
        error: `Cannot import: the following position name(s) already exist: ${list}. Please rename them in your CSV and try again.`,
      };
    }

    // 3) Import each position
    for (const row of rows) {
      let unitValue = row.unit_value;

      // If symbol present and unit_value missing, try to create symbol and fetch quote
      let canonicalSymbolId: string | null = null;
      const rawSymbolInput = row.symbolLookup?.trim() ?? "";

      if (rawSymbolInput !== "") {
        const resolved = await resolveSymbolInput(rawSymbolInput);

        if (resolved?.symbol?.id) {
          canonicalSymbolId = resolved.symbol.id;
        } else {
          const creationResult = await createSymbol(rawSymbolInput);
          if (!creationResult.success || !creationResult.data?.id) {
            return {
              success: false,
              error: `Failed to create symbol ${rawSymbolInput}: ${creationResult.message}`,
            };
          }

          const postCreateResolved = await resolveSymbolInput(rawSymbolInput);
          if (!postCreateResolved?.symbol?.id) {
            return {
              success: false,
              error: `Symbol ${rawSymbolInput} was created but could not be resolved to a canonical identifier`,
            };
          }

          canonicalSymbolId = postCreateResolved.symbol.id;
        }

        if (unitValue == null) {
          try {
            unitValue = await fetchSingleQuote(
              canonicalSymbolId ?? rawSymbolInput,
            );
          } catch {
            // Keep unitValue as null and let validation handle it
          }
        }
      }

      // For non-symbol imports, unit_value must be present and valid
      if (
        rawSymbolInput === "" &&
        (unitValue == null || !Number.isFinite(unitValue))
      ) {
        return {
          success: false,
          error: `Missing unit value for "${row.name}". Provide unit_value in CSV or provide a recognizable symbol to fetch price automatically.`,
        };
      }

      // 4) Delegate to existing server action (ensures sources hub + snapshot creation)
      const formData = new FormData();
      formData.append("type", "asset");
      formData.append("name", row.name);
      formData.append("currency", row.currency);
      formData.append("category_id", row.category_id);
      formData.append("quantity", String(row.quantity));
      formData.append("unit_value", unitValue != null ? String(unitValue) : "");
      formData.append(
        "symbolLookup",
        canonicalSymbolId ?? rawSymbolInput ?? "",
      );
      formData.append(
        "cost_basis_per_unit",
        row.cost_basis_per_unit != null ? String(row.cost_basis_per_unit) : "",
      );
      const capitalGainsTaxRate = normalizeCapitalGainsTaxRateToDecimal(
        row.capital_gains_tax_rate,
      );
      if (Number.isNaN(capitalGainsTaxRate)) {
        return {
          success: false,
          error: `Invalid capital gains tax rate for "${row.name}". Use a value between 0 and 100 (or 0 to 1 as decimal).`,
        };
      }
      formData.append(
        "capital_gains_tax_rate",
        capitalGainsTaxRate != null ? String(capitalGainsTaxRate) : "",
      );
      formData.append("description", row.description ?? "");

      const result = await createPosition(formData);
      if (!result.success) {
        return {
          success: false,
          error: `Failed to import "${row.name}": ${result.message}`,
        };
      }
    }

    revalidatePath("/dashboard", "layout");
    return { success: true, importedCount: rows.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import positions",
    };
  }
}
