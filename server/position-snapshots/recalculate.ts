"use server";

import { format } from "date-fns";

import { createServiceClient } from "@/supabase/service";
import { fetchMarketData } from "@/server/market-data/fetch";
import type { MarketDataPosition } from "@/server/market-data/sources/types";
import { MARKET_DATA_HANDLERS } from "@/server/market-data/sources/registry";

import type { PortfolioRecord } from "@/types/global.types";

interface RecalculateOptions {
  positionId: string;
  fromDate: Date;
  excludePortfolioRecordId?: string;
  newPortfolioRecordData?: Pick<
    PortfolioRecord,
    "type" | "quantity" | "unit_value" | "date"
  >;
}

/**
 * Recalculate position snapshots from a starting date until the next UPDATE record (exclusive).
 * Applies quantity and cost-basis rules and uses as-of market pricing for market-backed positions.
 */
export async function recalculateSnapshotsUntilNextUpdate(
  options: RecalculateOptions,
) {
  const {
    positionId,
    fromDate,
    excludePortfolioRecordId,
    newPortfolioRecordData,
  } = options;

  const supabase = await createServiceClient();

  // Fetch position owner, currency and identifiers (symbol/domain) to decide pricing source
  const { data: positionRow } = await supabase
    .from("positions")
    .select(
      `
      user_id,
      currency,
      position_sources_flat (
        type,
        symbol_id,
        domain_id
      )
    `,
    )
    .eq("id", positionId)
    .maybeSingle();

  if (!positionRow) {
    return {
      success: false,
      code: "POSITION_NOT_FOUND",
      message: "Position not found",
    } as const;
  }

  const userId: string = positionRow.user_id as string;
  const symbolId: string | null =
    positionRow.position_sources_flat?.symbol_id ?? null;
  const domainId: string | null =
    positionRow.position_sources_flat?.domain_id ?? null;
  const sourceType: "symbol" | "domain" | "custom" = symbolId
    ? "symbol"
    : domainId
      ? "domain"
      : "custom";
  const currency: string = positionRow.currency as string;

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
  let prQuery = supabase
    .from("portfolio_records")
    .select("*")
    .eq("position_id", positionId)
    .gte("date", format(fromDate, "yyyy-MM-dd"));

  if (boundaryDate) prQuery = prQuery.lt("date", boundaryDate);

  let { data: affectedRecords } = await prQuery
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

  // Find base snapshot (latest <= fromDate)
  const { data: baseSnapshot } = await supabase
    .from("position_snapshots")
    .select("quantity, cost_basis_per_unit, date, created_at")
    .eq("position_id", positionId)
    .eq("user_id", userId)
    .lte("date", format(fromDate, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Initialize running totals from base snapshot for each calculation
  let runningQuantity = baseSnapshot?.quantity || 0;
  let runningCostBasis = baseSnapshot?.cost_basis_per_unit || 0;
  const baseDate = baseSnapshot?.date ?? "1900-01-01";

  // Batch fetch all portfolio records between baseDate and the last affected date (exclusive of UPDATE boundary)
  const lastAffectedDate = affectedRecords[affectedRecords.length - 1]
    .date as string;
  let allRecordsQuery = supabase
    .from("portfolio_records")
    .select("id, type, quantity, unit_value, date, created_at")
    .eq("position_id", positionId)
    .gt("date", baseDate)
    .lte("date", lastAffectedDate)
    .neq("type", "update")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (boundaryDate) {
    allRecordsQuery = allRecordsQuery.lt("date", boundaryDate);
  }

  const { data: allRecords } = await allRecordsQuery;

  // Batch fetch existing snapshots for the affected portfolio_record_ids
  const affectedRecordIds = affectedRecords.map(
    (record) => record.id as string,
  );
  const { data: existingSnapshots } = await supabase
    .from("position_snapshots")
    .select("id, portfolio_record_id")
    .eq("position_id", positionId)
    .in("portfolio_record_id", affectedRecordIds);
  const snapshotIdByPortfolioRecordId = new Map<string, string>();
  existingSnapshots?.forEach((snapshotRow) => {
    if (snapshotRow.portfolio_record_id)
      snapshotIdByPortfolioRecordId.set(
        snapshotRow.portfolio_record_id,
        snapshotRow.id,
      );
  });

  // Batch market prices per unique date via aggregator
  const uniqueDates = Array.from(
    new Set(affectedRecords.map((r) => r.date as string)),
  );
  const priceByDate = new Map<string, number>();
  await Promise.all(
    uniqueDates.map(async (d) => {
      const price = await getMarketPriceForDate(d, 0);
      if (price && price > 0) priceByDate.set(d, price);
    }),
  );

  // Helper: apply record rule to running totals
  const applyRecord = (
    recordData: Pick<PortfolioRecord, "type" | "quantity" | "unit_value">,
  ) => {
    if (recordData.type === "buy") {
      const newShares = recordData.quantity;
      const newCostBasis = recordData.unit_value;
      if (runningQuantity > 0) {
        const totalCost =
          runningQuantity * runningCostBasis + newShares * newCostBasis;
        runningQuantity += newShares;
        runningCostBasis = totalCost / runningQuantity;
      } else {
        runningQuantity = newShares;
        runningCostBasis = newCostBasis;
      }
    } else if (recordData.type === "sell") {
      runningQuantity = Math.max(0, runningQuantity - recordData.quantity);
    } else if (recordData.type === "update") {
      runningQuantity = recordData.quantity;
      runningCostBasis = recordData.unit_value;
    }
  };

  // Helper: get market price for a given date (as-of) via aggregator
  async function getMarketPriceForDate(dateString: string, fallback: number) {
    if (sourceType === "custom") return fallback;

    const date = new Date(dateString);
    // Build minimal payload compatible with handlers
    const minimalPosition: MarketDataPosition = {
      currency,
      symbol_id: symbolId ?? null,
      domain_id: domainId ?? null,
    };

    try {
      const marketDataMap = await fetchMarketData([minimalPosition], date);

      const handler = MARKET_DATA_HANDLERS.find((h) => h.source === sourceType);
      if (!handler) return fallback;

      const key = handler.getKey(minimalPosition, date);
      if (!key) return fallback;
      return marketDataMap.get(key) || fallback;
    } catch {
      return fallback;
    }
  }

  // Iterate over affected records with a single pass over allRecords
  type PortfolioRecordSlice = Pick<
    PortfolioRecord,
    "id" | "type" | "quantity" | "unit_value" | "date" | "created_at"
  >;
  const allRecordsTyped: PortfolioRecordSlice[] = (allRecords ||
    []) as PortfolioRecordSlice[];

  let recordIndex = 0;
  for (const record of affectedRecords) {
    // Advance through allRecords up to current (date, created_at)
    const recordDate = record.date as string;
    const recordCreatedAt = record.created_at as string;
    while (
      recordIndex < allRecordsTyped.length &&
      ((allRecordsTyped[recordIndex].date as string) < recordDate ||
        ((allRecordsTyped[recordIndex].date as string) === recordDate &&
          (allRecordsTyped[recordIndex].created_at as string) <=
            recordCreatedAt))
    ) {
      const recordSlice = allRecordsTyped[recordIndex];
      const isExcluded =
        excludePortfolioRecordId && recordSlice.id === excludePortfolioRecordId;
      if (!isExcluded) {
        applyRecord({
          type: recordSlice.type,
          quantity: recordSlice.quantity,
          unit_value: recordSlice.unit_value,
        });
      }
      recordIndex++;
    }

    // Apply new in-flight data if it affects this date
    if (
      newPortfolioRecordData &&
      new Date(newPortfolioRecordData.date) <= new Date(record.date)
    ) {
      applyRecord(newPortfolioRecordData);
    }

    // If the current record is an UPDATE, apply it now (it's excluded from allRecords)
    if (record.type === "update") {
      applyRecord({
        type: "update",
        quantity: record.quantity as number,
        unit_value: record.unit_value as number,
      });
    }

    // Decide unit value for snapshot on this date
    const fallbackUnit = (record.unit_value as number) || runningCostBasis || 1;
    const snapshotUnitValue =
      priceByDate.get(record.date as string) ??
      (await getMarketPriceForDate(record.date as string, fallbackUnit)) ??
      fallbackUnit;

    // Try update existing snapshot tied to this portfolio_record_id, else insert
    const existingSnapshotId = snapshotIdByPortfolioRecordId.get(
      record.id as string,
    );
    if (existingSnapshotId) {
      await supabase
        .from("position_snapshots")
        .update({
          quantity: runningQuantity,
          unit_value: snapshotUnitValue,
          cost_basis_per_unit: runningCostBasis,
          date: record.date,
        })
        .eq("id", existingSnapshotId);
    } else {
      await supabase.from("position_snapshots").insert({
        user_id: userId,
        position_id: positionId,
        date: record.date,
        quantity: runningQuantity,
        unit_value: snapshotUnitValue,
        cost_basis_per_unit: runningCostBasis,
        portfolio_record_id: record.id,
      });
    }
  }

  return { success: true } as const;
}
