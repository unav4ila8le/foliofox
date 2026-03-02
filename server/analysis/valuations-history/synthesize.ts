import {
  buildCivilDateKeyRange,
  formatUTCDateKey,
  parseUTCDateKey,
  startOfUTCDay,
  type CivilDateKey,
} from "@/lib/date/date-utils";

/**
 * Minimal snapshot shape required to synthesize daily valuation rows.
 */
export interface DailyValuationSnapshotInput {
  id?: string;
  date: string;
  createdAt?: string | null;
  quantity: number;
  unitValue: number;
  costBasisPerUnit?: number | null;
}

/**
 * Per-position snapshot series input for daily synthesis.
 */
export interface DailyValuationPositionInput {
  id: string;
  snapshots: DailyValuationSnapshotInput[];
}

/**
 * Daily synthesized valuation row.
 */
export interface DailyValuationRow {
  date: Date;
  dateKey: CivilDateKey;
  quantity: number;
  unitValue: number;
  snapshotUnitValue: number;
  totalValue: number;
  costBasisPerUnit: number | null;
  priceSource: "market" | "snapshot";
}

interface SynthesizeDailyValuationsOptions {
  positions: DailyValuationPositionInput[];
  startDateKey: CivilDateKey;
  endDateKey: CivilDateKey;
  marketPricesByPositionDate?: Map<string, number>;
  includeZeroQuantityRows?: boolean;
  endDateKeyByPosition?: Map<string, CivilDateKey>;
}

const NEW_SNAPSHOT_CREATED_AT_SORT_KEY = "9999-12-31T23:59:59.999Z";

/**
 * Stable ordering for replaying snapshots in timeline order.
 */
function compareSnapshots(
  left: DailyValuationSnapshotInput,
  right: DailyValuationSnapshotInput,
) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  const leftCreatedAt = left.createdAt ?? NEW_SNAPSHOT_CREATED_AT_SORT_KEY;
  const rightCreatedAt = right.createdAt ?? NEW_SNAPSHOT_CREATED_AT_SORT_KEY;
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return (left.id ?? "").localeCompare(right.id ?? "");
}

/**
 * Build an inclusive civil-day span between start and end keys.
 */
function buildDateSpan(startDateKey: CivilDateKey, endDateKey: CivilDateKey) {
  return buildCivilDateKeyRange(startDateKey, endDateKey).map((dateKey) => ({
    date: parseUTCDateKey(dateKey),
    dateKey,
  }));
}

/**
 * Apply an optional per-position end cap while never exceeding the global end.
 */
function clampEndDateKey(
  globalEndDateKey: CivilDateKey,
  positionId: string,
  endDateKeyByPosition?: Map<string, CivilDateKey>,
) {
  const perPositionEndDateKey = endDateKeyByPosition?.get(positionId);
  if (!perPositionEndDateKey) return globalEndDateKey;
  return perPositionEndDateKey < globalEndDateKey
    ? perPositionEndDateKey
    : globalEndDateKey;
}

/**
 * Synthesize daily valuation rows from sparse snapshots.
 *
 * Behavior:
 * - rows are produced only from the first snapshot date onward
 * - latest snapshot at/before each day drives quantity and basis state
 * - market prices override snapshot unit values when available
 * - optional per-position end caps trim output (e.g. archived positions)
 */
export function synthesizeDailyValuationsByPosition({
  positions,
  startDateKey,
  endDateKey,
  marketPricesByPositionDate = new Map<string, number>(),
  includeZeroQuantityRows = true,
  endDateKeyByPosition,
}: SynthesizeDailyValuationsOptions): Map<string, DailyValuationRow[]> {
  const dateSpan = buildDateSpan(startDateKey, endDateKey);
  const rowsByPosition = new Map<string, DailyValuationRow[]>();

  if (!dateSpan.length) {
    return rowsByPosition;
  }

  const globalEndDateKey = dateSpan[dateSpan.length - 1].dateKey;

  for (const position of positions) {
    const snapshots = [...position.snapshots]
      .filter((snapshot) => snapshot.date)
      .sort(compareSnapshots);
    const rows: DailyValuationRow[] = [];

    if (snapshots.length === 0) {
      rowsByPosition.set(position.id, rows);
      continue;
    }

    const firstSnapshotDateKey = snapshots[0].date;
    const effectiveEndDateKey = clampEndDateKey(
      globalEndDateKey,
      position.id,
      endDateKeyByPosition,
    );

    // Position-level end cap can fully trim the requested range.
    if (effectiveEndDateKey < dateSpan[0].dateKey) {
      rowsByPosition.set(position.id, rows);
      continue;
    }

    let snapshotIndex = 0;
    let lastExplicitCostBasis: number | null =
      snapshots[0].costBasisPerUnit ?? null;

    for (const day of dateSpan) {
      const { date, dateKey } = day;

      if (dateKey > effectiveEndDateKey) {
        break;
      }

      // Do not synthesize rows before the first known snapshot.
      if (dateKey < firstSnapshotDateKey) {
        continue;
      }

      while (
        snapshotIndex + 1 < snapshots.length &&
        snapshots[snapshotIndex + 1].date <= dateKey
      ) {
        snapshotIndex += 1;
        const nextSnapshot = snapshots[snapshotIndex];
        if (nextSnapshot.costBasisPerUnit != null) {
          lastExplicitCostBasis = nextSnapshot.costBasisPerUnit;
        }
      }

      const snapshot = snapshots[snapshotIndex];
      if (!snapshot || snapshot.date > dateKey) {
        continue;
      }

      if (snapshot.costBasisPerUnit != null) {
        lastExplicitCostBasis = snapshot.costBasisPerUnit;
      }

      const quantity = Number(snapshot.quantity ?? 0);
      if (!includeZeroQuantityRows && quantity <= 0) {
        continue;
      }

      const marketKey = `${position.id}|${dateKey}`;
      const marketUnitValue = marketPricesByPositionDate.get(marketKey);
      const snapshotUnitValue = Number(snapshot.unitValue ?? 0);
      const unitValue =
        marketUnitValue !== undefined ? marketUnitValue : snapshotUnitValue;

      rows.push({
        date,
        dateKey,
        quantity,
        unitValue,
        snapshotUnitValue,
        totalValue: quantity * unitValue,
        costBasisPerUnit: lastExplicitCostBasis,
        priceSource: marketUnitValue !== undefined ? "market" : "snapshot",
      });
    }

    rowsByPosition.set(position.id, rows);
  }

  return rowsByPosition;
}

/**
 * Normalize a Date to a UTC day key (`YYYY-MM-DD`).
 */
export function toDateKeyFromUTCDate(date: Date) {
  return formatUTCDateKey(startOfUTCDay(date));
}

/**
 * Parse a UTC day key (`YYYY-MM-DD`) into a UTC Date.
 */
export function parseDateKeyToUTCDate(dateKey: string) {
  return parseUTCDateKey(dateKey);
}
