"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

import { parseRecordsCSV } from "@/lib/import/sources/records-csv";

import type { PortfolioRecord } from "@/types/global.types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";
import type { ImportActionResult } from "@/lib/import/types";

export async function importRecordsFromCSV(
  csvContent: string,
): Promise<ImportActionResult> {
  try {
    const parsed = await parseRecordsCSV(csvContent);
    if (!parsed.success) {
      return {
        success: false,
        error: (parsed.errors ?? ["Failed to parse CSV"]).join("\n"),
      };
    }

    const rows = parsed.records;
    const uniqueNames = Array.from(new Set(rows.map((r) => r.position_name)));

    const { supabase, user } = await getCurrentUser();

    const { data: positions, error: fetchError } = await supabase
      .from("positions")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("type", "asset")
      .is("archived_at", null)
      .in("name", uniqueNames);

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch positions: ${fetchError.message}`,
      };
    }

    const nameToId = new Map<string, string>();
    for (const position of positions ?? []) {
      nameToId.set(position.name, position.id);
    }

    const missingNames = uniqueNames.filter((name) => !nameToId.has(name));
    if (missingNames.length > 0) {
      return {
        success: false,
        error: `Cannot import records. Position(s) not found: ${missingNames.join(", ")}`,
      };
    }

    // Prepare records for batch insert
    const recordsToInsert: Array<
      Pick<
        PortfolioRecord,
        | "position_id"
        | "type"
        | "date"
        | "quantity"
        | "unit_value"
        | "description"
      >
    > = [];

    for (const row of rows) {
      const positionId = nameToId.get(row.position_name);
      if (!positionId) {
        return {
          success: false,
          error: `Position not found for record row: ${row.position_name}`,
        };
      }

      recordsToInsert.push({
        position_id: positionId,
        type: row.type as (typeof PORTFOLIO_RECORD_TYPES)[number],
        date: row.date,
        quantity: row.quantity,
        unit_value: row.unit_value,
        description: row.description ?? null,
      });
    }

    // Batch insert all records
    const { data: inserted, error: insertError } = await supabase
      .from("portfolio_records")
      .insert(recordsToInsert.map((rec) => ({ user_id: user.id, ...rec })))
      .select("id, position_id, date");

    if (insertError) {
      return {
        success: false,
        error: `Failed to insert records: ${insertError.message}`,
      };
    }

    if (!inserted || inserted.length === 0) {
      return {
        success: false,
        error: "No records were inserted",
      };
    }

    // Find earliest date per position and recalculate snapshots
    const positionDateMap = new Map<string, Date>();
    for (const record of inserted) {
      const date = new Date(record.date);
      const existing = positionDateMap.get(record.position_id);
      if (!existing || date < existing) {
        positionDateMap.set(record.position_id, date);
      }
    }

    // Recalculate snapshots for each affected position
    for (const [positionId, fromDate] of positionDateMap.entries()) {
      const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
        positionId,
        fromDate,
      });

      if (!recalculationResult.success) {
        return {
          success: false,
          error: `Failed to recalculate snapshots for position ${positionId}`,
        };
      }
    }

    revalidatePath("/dashboard", "layout");

    return {
      success: true,
      importedCount: rows.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import records",
    };
  }
}
