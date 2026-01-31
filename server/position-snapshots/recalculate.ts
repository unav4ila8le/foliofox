"use server";

import { createServiceClient } from "@/supabase/service";
import { formatUTCDateKey } from "@/lib/date/date-utils";

import type { PortfolioRecord } from "@/types/global.types";

interface RecalculateOptions {
  positionId: string;
  fromDate: Date;
  excludePortfolioRecordId?: string;
  customCostBasisByRecordId?: Record<string, number | null>;
}

/**
 * Recalculate position snapshots from a starting date until the next UPDATE record (exclusive).
 * Uses stored unit_value from portfolio records, no market data fetching.
 */
export async function recalculateSnapshotsUntilNextUpdate(
  options: RecalculateOptions,
) {
  const {
    positionId,
    fromDate,
    excludePortfolioRecordId,
    customCostBasisByRecordId,
  } = options;

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
    .gt("date", formatUTCDateKey(fromDate))
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const boundaryDate: string | undefined = nextUpdateRecord?.date;

  // Fetch affected portfolio records (between fromDate and boundary, if any)
  let portfolioRecordsQuery = supabase
    .from("portfolio_records")
    .select("*")
    .eq("position_id", positionId)
    .gte("date", formatUTCDateKey(fromDate));

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

  const affectedRecordIds = affectedRecords
    .map((record) => record.id)
    .filter((id): id is string => Boolean(id));

  // Get the base snapshot (latest before fromDate) - this is our reset point
  let { data: baseSnapshot } = await supabase
    .from("position_snapshots")
    .select(
      "quantity, cost_basis_per_unit, date, created_at, portfolio_record_id",
    )
    .eq("position_id", positionId)
    .lte("date", formatUTCDateKey(fromDate))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  while (
    baseSnapshot?.portfolio_record_id &&
    affectedRecordIds.includes(baseSnapshot.portfolio_record_id)
  ) {
    const { data: previousSnapshot } = await supabase
      .from("position_snapshots")
      .select(
        "quantity, cost_basis_per_unit, date, created_at, portfolio_record_id",
      )
      .eq("position_id", positionId)
      .lte("date", baseSnapshot.date as string)
      .lt("created_at", baseSnapshot.created_at as string)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    baseSnapshot = previousSnapshot ?? null;
  }

  const fromDateStr = formatUTCDateKey(fromDate);

  const costBasisByRecordId = new Map<string, number | null>();

  if (affectedRecordIds.length > 0) {
    const { data: existingSnapshots } = await supabase
      .from("position_snapshots")
      .select("portfolio_record_id, cost_basis_per_unit")
      .eq("position_id", positionId)
      .in("portfolio_record_id", affectedRecordIds);

    existingSnapshots?.forEach((snapshot) => {
      if (snapshot.portfolio_record_id) {
        costBasisByRecordId.set(
          snapshot.portfolio_record_id,
          snapshot.cost_basis_per_unit ?? null,
        );
      }
    });

    await supabase
      .from("position_snapshots")
      .delete()
      .eq("position_id", positionId)
      .in("portfolio_record_id", affectedRecordIds);
  }

  if (customCostBasisByRecordId) {
    for (const [recordId, value] of Object.entries(customCostBasisByRecordId)) {
      costBasisByRecordId.set(recordId, value ?? null);
    }
  }

  const windowStartDate = baseSnapshot?.date
    ? (baseSnapshot.date as string)
    : fromDateStr;

  let windowQuery = supabase
    .from("portfolio_records")
    .select("*")
    .eq("position_id", positionId)
    .gte("date", windowStartDate);

  if (boundaryDate) {
    windowQuery = windowQuery.lt("date", boundaryDate);
  }

  const { data: windowRecordsRaw } = await windowQuery
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  const baseSnapshotDate = (baseSnapshot?.date as string) ?? null;
  const baseSnapshotCreatedAt = (baseSnapshot?.created_at as string) ?? null;

  const windowRecords =
    windowRecordsRaw
      ?.filter((record) => {
        if (
          excludePortfolioRecordId &&
          record.id === excludePortfolioRecordId
        ) {
          return false;
        }

        if (baseSnapshotDate) {
          if (record.date === baseSnapshotDate) {
            if (
              baseSnapshotCreatedAt &&
              record.created_at <= baseSnapshotCreatedAt
            ) {
              return false;
            }
          } else if (record.date < baseSnapshotDate) {
            return false;
          }
        }

        if (boundaryDate && record.date >= boundaryDate) {
          return false;
        }

        return true;
      })
      .map((record) => record as PortfolioRecord) ?? [];

  if (windowRecords.length === 0) {
    return { success: true } as const;
  }

  let runningQuantity = Number(baseSnapshot?.quantity ?? 0);
  let runningCostBasis = Number(baseSnapshot?.cost_basis_per_unit ?? 0);

  const applyRecord = (recordItem: PortfolioRecord) => {
    const quantity = Number(recordItem.quantity);
    const unitValue = Number(recordItem.unit_value);

    if (recordItem.type === "buy") {
      if (runningQuantity > 0) {
        const totalCost =
          runningQuantity * runningCostBasis + quantity * unitValue;
        runningQuantity += quantity;
        runningCostBasis = totalCost / runningQuantity;
      } else {
        runningQuantity = quantity;
        runningCostBasis = unitValue;
      }
      return;
    }

    if (recordItem.type === "sell") {
      runningQuantity = Math.max(0, runningQuantity - quantity);
      return;
    }

    if (recordItem.type === "update") {
      runningQuantity = quantity;

      const override =
        (recordItem.id && costBasisByRecordId.get(recordItem.id)) ?? null;

      runningCostBasis =
        override != null ? Number(override) : Number(unitValue);
    }
  };

  for (const record of windowRecords) {
    applyRecord(record);

    const recordDate = record.date as string;

    if (recordDate < fromDateStr) {
      continue;
    }

    if (record.id) {
      await supabase
        .from("position_snapshots")
        .delete()
        .eq("position_id", positionId)
        .eq("portfolio_record_id", record.id);
    }

    const { error } = await supabase.from("position_snapshots").insert({
      user_id: record.user_id,
      position_id: positionId,
      date: record.date,
      quantity: runningQuantity,
      unit_value: Number(record.unit_value),
      cost_basis_per_unit: runningCostBasis,
      portfolio_record_id: record.id ?? null,
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
