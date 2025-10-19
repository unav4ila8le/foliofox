"use server";

import { fetchPositions } from "@/server/positions/fetch";
import { calculateProfitLoss } from "@/lib/profit-loss";

type ExportType = "asset" | "liability";

/**
 * Export user's positions to CSV format.
 * - Includes cost basis via snapshots (latest basis-aware snapshot per position)
 * - Filters by position type (asset/liability)
 */
export async function exportPositions(
  type: ExportType = "asset",
): Promise<
  { success: true; data: string } | { success: false; message: string }
> {
  try {
    // Fetch positions with snapshots once; we compute P/L from snapshots
    const { positions, snapshots } = await fetchPositions({
      positionType: type,
      includeSnapshots: true,
    });

    // Compute cost basis and P/L
    const positionsWithPL = calculateProfitLoss(positions, snapshots);

    // Empty CSV with headers when no data
    if (positionsWithPL.length === 0) {
      const headers =
        "name,category_id,currency,current_quantity,current_unit_value,total_value,cost_basis_per_unit,total_cost_basis,profit_loss,profit_loss_percentage,symbol_id,domain_id,description\n";
      return { success: true, data: headers } as const;
    }

    // Escape helper
    const escapeCsvValue = (
      value: string | number | null | undefined,
    ): string => {
      if (value === null || value === undefined) return "";
      const s = String(value);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    // Rows
    const rows = positionsWithPL.map((p) =>
      [
        escapeCsvValue(p.name),
        escapeCsvValue(p.category_id),
        escapeCsvValue(p.currency),
        escapeCsvValue(p.current_quantity),
        escapeCsvValue(p.current_unit_value),
        escapeCsvValue(p.total_value),
        escapeCsvValue(p.cost_basis_per_unit ?? 0),
        escapeCsvValue(p.total_cost_basis ?? 0),
        escapeCsvValue(p.profit_loss ?? 0),
        escapeCsvValue(p.profit_loss_percentage ?? 0),
        escapeCsvValue(p.symbol_id),
        escapeCsvValue(p.domain_id),
        escapeCsvValue(p.description),
      ].join(","),
    );

    const headers =
      "name,category_id,currency,current_quantity,current_unit_value,total_value,cost_basis_per_unit,total_cost_basis,profit_loss,profit_loss_percentage,symbol_id,domain_id,description";
    const csv = [headers, ...rows].join("\n");

    return { success: true, data: csv } as const;
  } catch (error) {
    console.error("Error exporting positions:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to export positions",
    } as const;
  }
}
