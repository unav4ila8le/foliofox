"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/actions";
import { recalculateSnapshotsUntilNextUpdate } from "@/server/position-snapshots/recalculate";

import { parsePortfolioRecordsCSV } from "@/lib/import/portfolio-records/parse-csv";
import { formatUTCDateKey } from "@/lib/date/date-utils";
import { validatePortfolioRecordTimelineWindow } from "@/server/portfolio-records/timeline-validator";

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
    const normalizePositionName = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLowerCase();
    const uniqueNames = Array.from(new Set(rows.map((r) => r.position_name)));

    const { supabase, user } = await getCurrentUser();

    const { data: positions, error: fetchError } = await supabase
      .from("positions")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("type", "asset")
      .is("archived_at", null);

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch positions: ${fetchError.message}`,
      };
    }

    const nameToId = new Map<string, { id: string; name: string }>();
    const duplicateNames = new Set<string>();
    for (const position of positions ?? []) {
      const normalized = normalizePositionName(position.name);
      const existing = nameToId.get(normalized);
      if (existing && existing.id !== position.id) {
        duplicateNames.add(position.name);
        duplicateNames.add(existing.name);
        continue;
      }
      nameToId.set(normalized, { id: position.id, name: position.name });
    }

    if (duplicateNames.size > 0) {
      return {
        success: false,
        error:
          "Cannot import records. Multiple positions share the same name when compared case-insensitively: " +
          Array.from(duplicateNames).join(", "),
      };
    }

    const missingNames = uniqueNames.filter(
      (name) => !nameToId.has(normalizePositionName(name)),
    );
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
    const importedTimelineByPosition = new Map<
      string,
      Array<{
        position_id: string;
        type: (typeof PORTFOLIO_RECORD_TYPES)[number];
        date: string;
        quantity: number;
        created_at: string;
        sourceLabel: string;
      }>
    >();
    const earliestImportedDateByPosition = new Map<string, string>();
    const importTimestampBase = Date.now();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const positionEntry = nameToId.get(
        normalizePositionName(row.position_name),
      );
      if (!positionEntry) {
        return {
          success: false,
          error: `Position not found for record row: ${row.position_name}`,
        };
      }

      const normalizedDate = formatUTCDateKey(row.date);
      const timelineRecord = {
        position_id: positionEntry.id,
        type: row.type as (typeof PORTFOLIO_RECORD_TYPES)[number],
        date: normalizedDate,
        quantity: row.quantity,
        unit_value: row.unit_value,
        description: row.description ?? null,
      };

      recordsToInsert.push(timelineRecord);

      const importedForPosition =
        importedTimelineByPosition.get(positionEntry.id) ?? [];
      importedForPosition.push({
        ...timelineRecord,
        created_at: new Date(importTimestampBase + rowIndex).toISOString(),
        sourceLabel: `Row ${rowIndex + 2}`,
      });
      importedTimelineByPosition.set(positionEntry.id, importedForPosition);

      const earliestDate = earliestImportedDateByPosition.get(positionEntry.id);
      if (!earliestDate || normalizedDate < earliestDate) {
        earliestImportedDateByPosition.set(positionEntry.id, normalizedDate);
      }
    }

    const affectedPositionIds = Array.from(
      earliestImportedDateByPosition.keys(),
    );
    const globalEarliestImportedDate = Array.from(
      earliestImportedDateByPosition.values(),
    ).sort()[0];

    if (affectedPositionIds.length > 0 && globalEarliestImportedDate) {
      const {
        data: existingAffectedRecords,
        error: existingAffectedRecordsError,
      } = await supabase
        .from("portfolio_records")
        .select("id, position_id, type, date, quantity, created_at")
        .eq("user_id", user.id)
        .in("position_id", affectedPositionIds)
        .gte("date", globalEarliestImportedDate);

      if (existingAffectedRecordsError) {
        return {
          success: false,
          error:
            existingAffectedRecordsError.message ??
            "Failed to validate imported record timelines",
        };
      }

      type ExistingTimelineRecord = {
        id: string;
        position_id: string;
        type: (typeof PORTFOLIO_RECORD_TYPES)[number];
        date: string;
        quantity: number;
        created_at: string;
      };

      const existingRecordsByPosition = new Map<
        string,
        ExistingTimelineRecord[]
      >();
      for (const record of existingAffectedRecords ?? []) {
        const positionEarliestDate = earliestImportedDateByPosition.get(
          record.position_id,
        );
        if (!positionEarliestDate || record.date < positionEarliestDate) {
          continue;
        }

        const list = existingRecordsByPosition.get(record.position_id) ?? [];
        list.push(record);
        existingRecordsByPosition.set(record.position_id, list);
      }

      for (const positionId of affectedPositionIds) {
        const timelineValidation = await validatePortfolioRecordTimelineWindow({
          supabase,
          userId: user.id,
          positionId,
          records: [
            ...(existingRecordsByPosition.get(positionId) ?? []),
            ...(importedTimelineByPosition.get(positionId) ?? []),
          ],
        });

        if (!timelineValidation.valid) {
          return {
            success: false,
            error: timelineValidation.message,
          };
        }
      }
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
      .gte("date", formatUTCDateKey(globalEarliest));

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
