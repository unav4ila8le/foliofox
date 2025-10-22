"use server";

import { format } from "date-fns";

import { createServiceClient } from "@/supabase/service";

import type { PortfolioRecord } from "@/types/global.types";

interface RecalculateOptions {
  positionId: string;
  fromDate: Date;
  excludePortfolioRecordId?: string;
  customCostBasis?: number | null;
}

/**
 * Recalculate position snapshots from a starting date until the next UPDATE record (exclusive).
 * Uses stored unit_value from portfolio records, no market data fetching.
 */
export async function recalculateSnapshotsUntilNextUpdate(
  options: RecalculateOptions,
) {
  const { positionId, fromDate, excludePortfolioRecordId, customCostBasis } =
    options;

  const supabase = await createServiceClient();

  // If recalculating for a delete, remove any snapshot tied to that record first
  if (excludePortfolioRecordId) {
    await supabase
      .from("position_snapshots")
      .delete()
      .eq("position_id", positionId)
      .eq("portfolio_record_id", excludePortfolioRecordId);
  }

  // Find the next UPDATE portfolio record after fromDate to establish boundary
  const { data: nextUpdateRecord } = await supabase
    .from("portfolio_records")
    .select("date")
    .eq("position_id", positionId)
    .eq("type", "update")
    .gt("date", format(fromDate, "yyyy-MM-dd"))
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const boundaryDate: string | undefined = nextUpdateRecord?.date;

  // Fetch affected portfolio records (between fromDate and boundary, if any)
  let portfolioRecordsQuery = supabase
    .from("portfolio_records")
    .select("*")
    .eq("position_id", positionId)
    .gte("date", format(fromDate, "yyyy-MM-dd"));

  if (boundaryDate)
    portfolioRecordsQuery = portfolioRecordsQuery.lt("date", boundaryDate);

  let { data: affectedRecords } = await portfolioRecordsQuery
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (!affectedRecords || affectedRecords.length === 0) {
    return { success: true } as const;
  }

  // Optionally exclude a specific record from consideration (edit/delete flows)
  if (excludePortfolioRecordId) {
    affectedRecords = affectedRecords.filter(
      (r) => r.id !== excludePortfolioRecordId,
    );
  }

  // Get the base snapshot (latest before fromDate) - this is our reset point
  const { data: baseSnapshot } = await supabase
    .from("position_snapshots")
    .select("quantity, cost_basis_per_unit, date, created_at")
    .eq("position_id", positionId)
    .lte("date", format(fromDate, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Process each record in sequence and create one snapshot per record
  for (const record of affectedRecords) {
    // Get all records up to this record's date (within our boundary)
    let recordsQuery = supabase
      .from("portfolio_records")
      .select("*")
      .eq("position_id", positionId);

    // Handle same-day vs different-day base snapshots
    if (baseSnapshot?.date === record.date) {
      // Same day: only include records created after the base snapshot but before/at current record
      recordsQuery = recordsQuery
        .eq("date", record.date)
        .gt("created_at", baseSnapshot.created_at)
        .lte("created_at", record.created_at);
    } else {
      // Different day: include all records from base snapshot date forward up to current record
      recordsQuery = recordsQuery
        .gte("date", baseSnapshot?.date || "1900-01-01")
        .lte("date", record.date);
    }

    // Apply boundary to records query as well
    if (boundaryDate) {
      recordsQuery = recordsQuery.lt("date", boundaryDate);
    }

    let { data: records } = await recordsQuery
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    // Filter out excluded record if specified
    if (excludePortfolioRecordId) {
      records = records?.filter((r) => r.id !== excludePortfolioRecordId) || [];
    }

    // Initialize running totals from base snapshot
    let runningQuantity = (baseSnapshot?.quantity as number) || 0;
    let runningCostBasis = (baseSnapshot?.cost_basis_per_unit as number) || 0;

    // Helper function to apply record to running quantities and cost basis
    const applyRecord = (
      recordData: Pick<PortfolioRecord, "type" | "quantity" | "unit_value">,
    ) => {
      if (recordData.type === "buy") {
        // Calculate weighted average cost basis for purchases
        const newShares = recordData.quantity;
        const newCostBasis = recordData.unit_value;

        if (runningQuantity > 0) {
          // Weighted average: (existing_cost * existing_shares + new_cost * new_shares) / total_shares
          const totalCost =
            runningQuantity * runningCostBasis + newShares * newCostBasis;
          runningQuantity += newShares;
          runningCostBasis = totalCost / runningQuantity;
        } else {
          // First purchase or starting from zero
          runningQuantity = newShares;
          runningCostBasis = newCostBasis;
        }
      } else if (recordData.type === "sell") {
        // FIFO: Keep same cost basis per unit, reduce quantity
        runningQuantity = Math.max(0, runningQuantity - recordData.quantity);
        // Cost basis per unit remains the same when selling
      } else if (recordData.type === "update") {
        // UPDATE = Reset point - set absolute values
        runningQuantity = recordData.quantity;
        // Use custom cost basis if provided, otherwise use unit_value
        runningCostBasis = customCostBasis ?? recordData.unit_value;
      }
    };

    // Apply all records up to this record's date (excluding the current record)
    for (const recordItem of records || []) {
      if (recordItem.id !== record.id) {
        applyRecord(recordItem);
      }
    }

    // Apply the current record to get the final state
    applyRecord(record);

    // Use the stored unit_value from the portfolio record (no market data fetching)
    const snapshotUnitValue = record.unit_value as number;

    // Delete any existing snapshot for this record to avoid duplicates
    await supabase
      .from("position_snapshots")
      .delete()
      .eq("position_id", positionId)
      .eq("portfolio_record_id", record.id);

    // Create snapshot for this specific record
    const { error } = await supabase.from("position_snapshots").insert({
      user_id: record.user_id,
      position_id: positionId,
      date: record.date,
      quantity: runningQuantity,
      unit_value: snapshotUnitValue,
      cost_basis_per_unit: runningCostBasis,
      portfolio_record_id: record.id,
    });

    if (error) {
      return {
        success: false,
        code: error.code ?? "SNAPSHOT_INSERT_FAILED",
        message: error.message ?? "Failed to insert position snapshot",
      } as const;
    }
  }

  return { success: true } as const;
}
