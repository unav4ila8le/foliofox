"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

import { parsePortfolioRecordsCSV } from "@/lib/import/portfolio-records/parse-csv";

import type { PortfolioRecord } from "@/types/global.types";
import { PORTFOLIO_RECORD_TYPES } from "@/types/enums";
import type { ImportActionResult } from "@/lib/import/shared/types";

export async function importPortfolioRecordsFromCSV(
  csvContent: string,
): Promise<ImportActionResult> {
  try {
    const parsed = await parsePortfolioRecordsCSV(csvContent);
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

    // Build map of earliest imported date per position
    const positionDateMap = new Map<string, Date>();
    for (const record of inserted) {
      const date = new Date(record.date);
      const existing = positionDateMap.get(record.position_id);
      if (!existing || date < existing) {
        positionDateMap.set(record.position_id, date);
      }
    }

    // Query all UPDATE records for affected positions in one batch (N+1 avoidance).
    // We need to recalculate from each UPDATE boundary to ensure all imported
    // records get snapshotted, even if they span existing or newly imported UPDATEs.
    const positionIds = Array.from(positionDateMap.keys());
    const globalEarliest = new Date(
      Math.min(...Array.from(positionDateMap.values()).map((d) => d.getTime())),
    );

    const { data: updates } = await supabase
      .from("portfolio_records")
      .select("position_id, date")
      .eq("type", "update")
      .in("position_id", positionIds)
      .gte("date", format(globalEarliest, "yyyy-MM-dd"));

    // Group UPDATE dates by position
    const updatesByPosition = new Map<string, Date[]>();
    for (const u of updates ?? []) {
      const list = updatesByPosition.get(u.position_id) ?? [];
      list.push(new Date(u.date));
      updatesByPosition.set(u.position_id, list);
    }

    // Recalculate snapshots for each position, starting from earliest imported
    // date and then from each UPDATE boundary to cover all segments
    for (const [positionId, earliestDate] of positionDateMap.entries()) {
      const dates = [
        earliestDate,
        ...(updatesByPosition.get(positionId) ?? []).filter(
          (d) => d.getTime() >= earliestDate.getTime(),
        ),
      ];

      // Dedupe and sort by date
      const uniqueSorted = Array.from(
        new Map(dates.map((d) => [d.getTime(), d])).values(),
      ).sort((a, b) => a.getTime() - b.getTime());

      for (const startDate of uniqueSorted) {
        const recalculationResult = await recalculateSnapshotsUntilNextUpdate({
          positionId,
          fromDate: startDate,
        });

        if (!recalculationResult.success) {
          return {
            success: false,
            error: `Failed to recalculate snapshots for position ${positionId}`,
          };
        }
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
