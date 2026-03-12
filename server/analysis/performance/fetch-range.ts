"use server";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import {
  fetchMarketDataRange,
  toMarketDataPositions,
} from "@/server/market-data/fetch";
import { synthesizeDailyValuationsByPosition } from "@/server/analysis/valuations-history/synthesize";
import { calculateTimeWeightedReturnSeries } from "@/server/analysis/performance/methodologies/time-weighted-return";
import {
  parsePerformanceMethodology,
  parsePerformanceScope,
  type PerformanceMethodology,
  type PerformanceRangeData,
  type PerformanceScope,
} from "@/server/analysis/performance/types";
import { convertCurrency } from "@/lib/currency-conversion";
import {
  addCivilDateKeyDays,
  buildCivilDateKeyRange,
  parseUTCDateKey,
  resolveTodayDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";
import type { Database } from "@/types/database.types";

type EligibleAssetRow = {
  id: string;
  currency: string;
  symbol_id: string | null;
};

type SnapshotRow = {
  id: string;
  position_id: string;
  date: CivilDateKey;
  quantity: number;
  unit_value: number;
  created_at: string;
  cost_basis_per_unit: number | null;
};

type PortfolioRecordRow = {
  position_id: string;
  date: CivilDateKey;
  quantity: number;
  unit_value: number;
  type: "buy" | "sell" | "update";
};

const PERFORMANCE_UNAVAILABLE_MESSAGES = {
  no_eligible_positions:
    "Performance is available only for symbol-backed investments.",
  insufficient_history:
    "Not enough history is available for the selected range.",
} as const;

const QUANTITY_EPSILON = 1e-9;

function buildUnavailablePerformanceRange(
  methodology: PerformanceMethodology,
  scope: PerformanceScope,
  unavailableReason: keyof typeof PERFORMANCE_UNAVAILABLE_MESSAGES,
): PerformanceRangeData {
  return {
    isAvailable: false,
    methodology,
    scope,
    history: [],
    summary: null,
    unavailableReason,
    message: PERFORMANCE_UNAVAILABLE_MESSAGES[unavailableReason],
  };
}

async function fetchEligibleSymbolAssets(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: positions, error } = await supabase
    .from("positions")
    .select("id, currency, symbol_id")
    .eq("user_id", userId)
    .eq("type", "asset")
    .not("symbol_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return (positions ?? []) as EligibleAssetRow[];
}

async function fetchSnapshotsForPositions(
  supabase: SupabaseClient<Database>,
  userId: string,
  positionIds: string[],
  endDateKey: CivilDateKey,
) {
  const { data: snapshots, error } = await supabase
    .from("position_snapshots")
    .select(
      "id, position_id, date, quantity, unit_value, created_at, cost_basis_per_unit",
    )
    .eq("user_id", userId)
    .in("position_id", positionIds)
    .lte("date", endDateKey)
    .order("position_id")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (snapshots ?? []) as SnapshotRow[];
}

async function fetchPortfolioRecordsForRange(
  supabase: SupabaseClient<Database>,
  userId: string,
  positionIds: string[],
  startDateKey: CivilDateKey,
  endDateKey: CivilDateKey,
) {
  const { data: records, error } = await supabase
    .from("portfolio_records")
    .select("position_id, date, quantity, unit_value, type")
    .eq("user_id", userId)
    .in("position_id", positionIds)
    .gte("date", startDateKey)
    .lte("date", endDateKey)
    .in("type", ["buy", "sell", "update"])
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (records ?? []) as PortfolioRecordRow[];
}

function buildSnapshotsByPosition(snapshots: SnapshotRow[]) {
  const snapshotsByPosition = new Map<string, SnapshotRow[]>();

  snapshots.forEach((snapshot) => {
    const rows = snapshotsByPosition.get(snapshot.position_id) ?? [];
    rows.push(snapshot);
    snapshotsByPosition.set(snapshot.position_id, rows);
  });

  return snapshotsByPosition;
}

function buildInitialQuantityByPosition(options: {
  activePositions: EligibleAssetRow[];
  snapshotsByPosition: Map<string, SnapshotRow[]>;
  startDateKey: CivilDateKey;
}) {
  const { activePositions, snapshotsByPosition, startDateKey } = options;
  const initialQuantityByPosition = new Map<string, number>();

  activePositions.forEach((position) => {
    const snapshots = snapshotsByPosition.get(position.id) ?? [];
    let runningQuantity = 0;

    for (const snapshot of snapshots) {
      if (snapshot.date >= startDateKey) {
        break;
      }

      runningQuantity = Number(snapshot.quantity ?? 0);
    }

    initialQuantityByPosition.set(position.id, runningQuantity);
  });

  return initialQuantityByPosition;
}

function buildDailyUnitValueLookupByPosition(
  dailyRowsByPosition: ReturnType<typeof synthesizeDailyValuationsByPosition>,
) {
  const dailyUnitValueLookupByPosition = new Map<
    string,
    Map<CivilDateKey, number>
  >();

  dailyRowsByPosition.forEach((rows, positionId) => {
    dailyUnitValueLookupByPosition.set(
      positionId,
      new Map(rows.map((row) => [row.dateKey, row.unitValue])),
    );
  });

  return dailyUnitValueLookupByPosition;
}

function buildPriorQuantityLookupByPositionDate(options: {
  initialQuantityByPosition: Map<string, number>;
  dailyRowsByPosition: ReturnType<typeof synthesizeDailyValuationsByPosition>;
}) {
  const { initialQuantityByPosition, dailyRowsByPosition } = options;
  const priorQuantityLookupByPositionDate = new Map<
    string,
    Map<CivilDateKey, number>
  >();

  dailyRowsByPosition.forEach((rows, positionId) => {
    let previousQuantity = initialQuantityByPosition.get(positionId) ?? 0;
    const priorQuantityByDate = new Map<CivilDateKey, number>();

    rows.forEach((row) => {
      priorQuantityByDate.set(row.dateKey, previousQuantity);
      previousQuantity = row.quantity;
    });

    priorQuantityLookupByPositionDate.set(positionId, priorQuantityByDate);
  });

  return priorQuantityLookupByPositionDate;
}

function buildDailyTotalValueLookupByPosition(options: {
  activePositions: EligibleAssetRow[];
  resolvedTargetCurrency: string;
  fxMap: Awaited<ReturnType<typeof fetchExchangeRates>>;
  dailyRowsByPosition: ReturnType<typeof synthesizeDailyValuationsByPosition>;
}) {
  const {
    activePositions,
    resolvedTargetCurrency,
    fxMap,
    dailyRowsByPosition,
  } = options;
  const positionsById = new Map(
    activePositions.map((position) => [position.id, position]),
  );
  const dailyTotalValueLookupByPosition = new Map<
    string,
    Map<string, number>
  >();

  dailyRowsByPosition.forEach((rows, positionId) => {
    const positionCurrency =
      positionsById.get(positionId)?.currency ?? resolvedTargetCurrency;

    dailyTotalValueLookupByPosition.set(
      positionId,
      new Map(
        rows.map((row) => [
          row.dateKey,
          convertCurrency(
            row.totalValue,
            positionCurrency,
            resolvedTargetCurrency,
            fxMap,
            row.dateKey,
          ),
        ]),
      ),
    );
  });

  return dailyTotalValueLookupByPosition;
}

function buildNetFlowsByDateKey(options: {
  records: PortfolioRecordRow[];
  activePositions: EligibleAssetRow[];
  resolvedTargetCurrency: string;
  fxMap: Awaited<ReturnType<typeof fetchExchangeRates>>;
  initialQuantityByPosition: Map<string, number>;
  priorQuantityLookupByPositionDate: Map<string, Map<CivilDateKey, number>>;
  dailyUnitValueLookupByPosition: Map<string, Map<CivilDateKey, number>>;
}) {
  const {
    records,
    activePositions,
    resolvedTargetCurrency,
    fxMap,
    initialQuantityByPosition,
    priorQuantityLookupByPositionDate,
    dailyUnitValueLookupByPosition,
  } = options;
  const positionsById = new Map(
    activePositions.map((position) => [position.id, position]),
  );
  const runningQuantityByPosition = new Map(initialQuantityByPosition);
  const initializedDateByPosition = new Map<string, CivilDateKey>();
  const netFlowsByDateKey = new Map<CivilDateKey, number>();
  let includesEstimatedFlows = false;

  records.forEach((record) => {
    const position = positionsById.get(record.position_id);
    if (!position) {
      return;
    }

    const currentRunningQuantity =
      runningQuantityByPosition.get(record.position_id) ?? 0;

    if (initializedDateByPosition.get(record.position_id) !== record.date) {
      const priorQuantity =
        priorQuantityLookupByPositionDate
          .get(record.position_id)
          ?.get(record.date) ?? currentRunningQuantity;

      runningQuantityByPosition.set(record.position_id, priorQuantity);
      initializedDateByPosition.set(record.position_id, record.date);
    }

    const replayQuantity =
      runningQuantityByPosition.get(record.position_id) ?? 0;

    if (record.type === "update") {
      const nextQuantity = Number(record.quantity ?? 0);
      const deltaQuantity = nextQuantity - replayQuantity;

      // Quantity-stable updates are cost-basis or metadata corrections only.
      if (Math.abs(deltaQuantity) > QUANTITY_EPSILON) {
        const effectiveUnitValue =
          dailyUnitValueLookupByPosition
            .get(record.position_id)
            ?.get(record.date) ?? Number(record.unit_value ?? 0);
        const localAmount = deltaQuantity * effectiveUnitValue;
        const convertedAmount = convertCurrency(
          localAmount,
          position.currency,
          resolvedTargetCurrency,
          fxMap,
          record.date,
        );

        netFlowsByDateKey.set(
          record.date,
          (netFlowsByDateKey.get(record.date) ?? 0) + convertedAmount,
        );
        includesEstimatedFlows = true;
      }

      runningQuantityByPosition.set(record.position_id, nextQuantity);
      return;
    }

    const localAmount =
      Number(record.quantity ?? 0) * Number(record.unit_value ?? 0);
    const convertedAmount = convertCurrency(
      localAmount,
      position.currency,
      resolvedTargetCurrency,
      fxMap,
      record.date,
    );
    const signedAmount =
      record.type === "sell" ? -convertedAmount : convertedAmount;

    netFlowsByDateKey.set(
      record.date,
      (netFlowsByDateKey.get(record.date) ?? 0) + signedAmount,
    );

    if (record.type === "buy") {
      runningQuantityByPosition.set(
        record.position_id,
        replayQuantity + Number(record.quantity ?? 0),
      );
      return;
    }

    runningQuantityByPosition.set(
      record.position_id,
      Math.max(0, replayQuantity - Number(record.quantity ?? 0)),
    );
  });

  return { netFlowsByDateKey, includesEstimatedFlows };
}

async function fetchPortfolioPerformanceRangeImpl({
  targetCurrency,
  daysBack,
  methodology,
  scope,
}: {
  targetCurrency?: string;
  daysBack: number;
  methodology: PerformanceMethodology;
  scope: PerformanceScope;
}): Promise<PerformanceRangeData> {
  const { profile } = await fetchProfile();
  const resolvedTargetCurrency = targetCurrency ?? profile.display_currency;
  const resolvedMethodology = parsePerformanceMethodology(methodology);
  const resolvedScope = parsePerformanceScope(scope);
  const totalDaysBack = Math.max(1, Math.trunc(daysBack));
  const endDateKey = resolveTodayDateKey(profile.time_zone);
  const startDateKey = addCivilDateKeyDays(endDateKey, -(totalDaysBack - 1));
  const dateKeys = buildCivilDateKeyRange(startDateKey, endDateKey);
  const dates = dateKeys.map((dateKey) => parseUTCDateKey(dateKey));

  const { user, supabase } = await getCurrentUser();

  const positions = await fetchEligibleSymbolAssets(supabase, user.id);
  if (!positions.length) {
    return buildUnavailablePerformanceRange(
      resolvedMethodology,
      resolvedScope,
      "no_eligible_positions",
    );
  }

  const positionIds = positions.map((position) => position.id);
  const [snapshots, records] = await Promise.all([
    fetchSnapshotsForPositions(supabase, user.id, positionIds, endDateKey),
    fetchPortfolioRecordsForRange(
      supabase,
      user.id,
      positionIds,
      startDateKey,
      endDateKey,
    ),
  ]);

  if (!snapshots.length) {
    return buildUnavailablePerformanceRange(
      resolvedMethodology,
      resolvedScope,
      "insufficient_history",
    );
  }

  const snapshotsByPosition = buildSnapshotsByPosition(snapshots);
  const activePositions = positions.filter((position) =>
    snapshotsByPosition.has(position.id),
  );

  if (!activePositions.length) {
    return buildUnavailablePerformanceRange(
      resolvedMethodology,
      resolvedScope,
      "insufficient_history",
    );
  }

  const pointerPrepass = new Map<string, number>();
  const eligibleDateIndices = new Set<number>();
  const eligibleDateKeysByPosition = new Map<string, Set<CivilDateKey>>();

  for (let dateIndex = 0; dateIndex < dates.length; dateIndex += 1) {
    const dateKey = dateKeys[dateIndex];

    for (const position of activePositions) {
      const rows = snapshotsByPosition.get(position.id);
      if (!rows?.length) continue;

      let rowIndex = pointerPrepass.get(position.id) ?? 0;
      while (rowIndex + 1 < rows.length && rows[rowIndex + 1].date <= dateKey) {
        rowIndex += 1;
      }
      pointerPrepass.set(position.id, rowIndex);

      const snapshot = rows[rowIndex];
      if (!snapshot || snapshot.date > dateKey) continue;
      if (snapshot.quantity <= 0) continue;

      eligibleDateIndices.add(dateIndex);
      const eligibleDates =
        eligibleDateKeysByPosition.get(position.id) ?? new Set<CivilDateKey>();
      eligibleDates.add(dateKey);
      eligibleDateKeysByPosition.set(position.id, eligibleDates);
    }
  }

  const marketDataDates = Array.from(eligibleDateIndices)
    .sort((left, right) => left - right)
    .map((index) => dates[index]);

  const marketPositionsMinimal = await toMarketDataPositions(
    activePositions.map((position) => ({
      id: position.id,
      currency: position.currency,
      symbol_id: position.symbol_id,
      domain_id: null,
    })),
  );

  const eligibleDatesForHandlers = new Map<string, Set<string>>();
  eligibleDateKeysByPosition.forEach((value, positionId) => {
    eligibleDatesForHandlers.set(positionId, new Set(value));
  });

  const marketPricesByPositionDate =
    marketPositionsMinimal.length && marketDataDates.length
      ? await fetchMarketDataRange(marketPositionsMinimal, marketDataDates, {
          upsert: true,
          eligibleDates: eligibleDatesForHandlers,
        })
      : new Map<string, number>();

  const currencies = new Set<string>([resolvedTargetCurrency]);
  activePositions.forEach((position) => currencies.add(position.currency));

  const fxRequests: { currency: string; date: Date }[] = [];
  const fxDedup = new Set<string>();
  for (const currency of currencies) {
    dates.forEach((date, index) => {
      const dateKey = dateKeys[index];
      const dedupKey = `${currency}|${dateKey}`;
      if (fxDedup.has(dedupKey)) return;
      fxDedup.add(dedupKey);
      fxRequests.push({ currency, date });
    });
  }

  const fxMap = await fetchExchangeRates(fxRequests);
  const dailyRowsByPosition = synthesizeDailyValuationsByPosition({
    positions: activePositions.map((position) => ({
      id: position.id,
      snapshots: (snapshotsByPosition.get(position.id) ?? []).map(
        (snapshot) => ({
          id: snapshot.id,
          date: snapshot.date,
          createdAt: snapshot.created_at,
          quantity: snapshot.quantity,
          unitValue: snapshot.unit_value,
          costBasisPerUnit: snapshot.cost_basis_per_unit,
        }),
      ),
    })),
    startDateKey,
    endDateKey,
    marketPricesByPositionDate,
    includeZeroQuantityRows: true,
  });

  const initialQuantityByPosition = buildInitialQuantityByPosition({
    activePositions,
    snapshotsByPosition,
    startDateKey,
  });
  const priorQuantityLookupByPositionDate =
    buildPriorQuantityLookupByPositionDate({
      initialQuantityByPosition,
      dailyRowsByPosition,
    });
  const dailyUnitValueLookupByPosition =
    buildDailyUnitValueLookupByPosition(dailyRowsByPosition);
  const dailyTotalValueLookupByPosition = buildDailyTotalValueLookupByPosition({
    activePositions,
    resolvedTargetCurrency,
    fxMap,
    dailyRowsByPosition,
  });
  const { netFlowsByDateKey, includesEstimatedFlows } = buildNetFlowsByDateKey({
    records,
    activePositions,
    resolvedTargetCurrency,
    fxMap,
    initialQuantityByPosition,
    priorQuantityLookupByPositionDate,
    dailyUnitValueLookupByPosition,
  });

  // Record dates are civil-day only, so portfolio flows are linked at day
  // granularity before calculating the daily time-weighted return series.
  const dailyInputs = dateKeys.map((dateKey) => ({
    dateKey,
    totalValue: activePositions.reduce((sum, position) => {
      return (
        sum +
        (dailyTotalValueLookupByPosition.get(position.id)?.get(dateKey) ?? 0)
      );
    }, 0),
    netFlow: netFlowsByDateKey.get(dateKey) ?? 0,
  }));

  const series = calculateTimeWeightedReturnSeries(dailyInputs);
  if (series.length < 2) {
    return buildUnavailablePerformanceRange(
      resolvedMethodology,
      resolvedScope,
      "insufficient_history",
    );
  }

  const history = series.map((point) => ({
    date: parseUTCDateKey(point.dateKey),
    dateKey: point.dateKey,
    cumulativeReturnPct: point.cumulativeReturnPct,
  }));

  const summary = {
    startDateKey: history[0].dateKey,
    endDateKey: history[history.length - 1].dateKey,
    cumulativeReturnPct: history[history.length - 1].cumulativeReturnPct,
  };

  return {
    isAvailable: true,
    methodology: resolvedMethodology,
    scope: resolvedScope,
    history,
    summary,
    includesEstimatedFlows,
    unavailableReason: null,
    message: null,
  };
}

const fetchPortfolioPerformanceRangeCached = cache(
  async (
    targetCurrency: string | undefined,
    daysBack: number,
    methodology: PerformanceMethodology,
    scope: PerformanceScope,
  ) =>
    fetchPortfolioPerformanceRangeImpl({
      targetCurrency,
      daysBack,
      methodology,
      scope,
    }),
);

export async function fetchPortfolioPerformanceRange({
  targetCurrency,
  daysBack = 180,
  methodology = "time_weighted_return",
  scope = "symbol_assets",
}: {
  targetCurrency?: string;
  daysBack?: number;
  methodology?: PerformanceMethodology;
  scope?: PerformanceScope;
}): Promise<PerformanceRangeData> {
  return fetchPortfolioPerformanceRangeCached(
    targetCurrency,
    daysBack,
    methodology,
    scope,
  );
}
