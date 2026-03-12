"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import {
  fetchMarketDataRange,
  toMarketDataPositions,
} from "@/server/market-data/fetch";
import {
  synthesizeDailyValuationsByPosition,
  type DailyValuationRow,
} from "@/server/analysis/valuations-history/synthesize";
import { calculateCapitalGainsTaxAmount } from "@/server/analysis/net-worth/capital-gains-tax";
import { convertCurrency } from "@/lib/currency-conversion";
import {
  addCivilDateKeyDays,
  buildCivilDateKeyRange,
  parseUTCDateKey,
  resolveTodayDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";
import type { NetWorthMode } from "@/server/analysis/net-worth/types";

export interface NetWorthHistoryData {
  date: Date;
  dateKey: CivilDateKey;
  value: number;
}

function mapDateKeysToZeroHistory(
  dateKeys: CivilDateKey[],
): NetWorthHistoryData[] {
  return dateKeys.map((dateKey) => ({
    date: parseUTCDateKey(dateKey),
    dateKey,
    value: 0,
  }));
}

export async function fetchNetWorthHistory({
  targetCurrency,
  daysBack = 180,
  mode = "gross",
}: {
  targetCurrency?: string;
  daysBack?: number;
  mode?: NetWorthMode;
}): Promise<NetWorthHistoryData[]> {
  // 1) Resolve profile once to keep currency/timezone defaults consistent.
  const { profile } = await fetchProfile();
  const resolvedTargetCurrency = targetCurrency ?? profile.display_currency;

  // 2) Build an inclusive civil-day axis in the user's timezone.
  const totalDaysBack = Math.max(1, Math.trunc(daysBack));
  const endDateKey = resolveTodayDateKey(profile.time_zone);
  const startDateKey = addCivilDateKeyDays(endDateKey, -(totalDaysBack - 1));
  const dateKeys = buildCivilDateKeyRange(startDateKey, endDateKey);
  const dates = dateKeys.map((dateKey) => parseUTCDateKey(dateKey));

  const { user, supabase } = await getCurrentUser();

  // 3) Fetch positions once (include archived by not filtering archived_at).
  const { data: positions, error: positionsError } = await supabase
    .from("positions")
    .select(
      "id, currency, symbol_id, domain_id, user_id, type, capital_gains_tax_rate",
    )
    .eq("user_id", user.id);

  if (positionsError) throw new Error(positionsError.message);

  if (!positions?.length) {
    return mapDateKeysToZeroHistory(dateKeys);
  }

  const positionIds = positions.map((position) => position.id);

  // 4) Fetch snapshots once for the full range.
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("position_snapshots")
    .select(
      "id, position_id, date, quantity, unit_value, created_at, cost_basis_per_unit",
    )
    .eq("user_id", user.id)
    .in("position_id", positionIds)
    .lte("date", endDateKey)
    .order("position_id")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (snapshotsError) {
    throw new Error(snapshotsError.message);
  }

  if (!snapshots || !snapshots.length) {
    return mapDateKeysToZeroHistory(dateKeys);
  }

  const snapshotsByPosition = new Map<
    string,
    {
      id: string;
      date: string;
      created_at: string;
      quantity: number;
      unit_value: number;
      cost_basis_per_unit: number | null;
    }[]
  >();

  snapshots.forEach((snapshot) => {
    const rows = snapshotsByPosition.get(snapshot.position_id) || [];
    rows.push({
      id: snapshot.id,
      date: snapshot.date,
      created_at: snapshot.created_at,
      quantity: snapshot.quantity,
      unit_value: snapshot.unit_value,
      cost_basis_per_unit: snapshot.cost_basis_per_unit ?? null,
    });
    snapshotsByPosition.set(snapshot.position_id, rows);
  });

  const earliestSnapshotDate = snapshots.reduce<string | null>(
    (min, snapshot) => {
      if (!snapshot.date) return min;
      if (!min || snapshot.date < min) return snapshot.date;
      return min;
    },
    null,
  );

  let processingDates = dates;
  let processingDateKeys = dateKeys;
  let paddingCount = 0;

  if (earliestSnapshotDate) {
    const firstActiveIndex = dateKeys.findIndex(
      (dateKey) => dateKey >= earliestSnapshotDate,
    );

    if (firstActiveIndex === -1) {
      return mapDateKeysToZeroHistory(dateKeys);
    }

    if (firstActiveIndex > 0) {
      paddingCount = firstActiveIndex;
      processingDates = dates.slice(firstActiveIndex);
      processingDateKeys = dateKeys.slice(firstActiveIndex);
    }
  }

  if (!processingDates.length) {
    return mapDateKeysToZeroHistory(dateKeys);
  }

  const activePositions = positions.filter((position) => {
    const rows = snapshotsByPosition.get(position.id);
    return Boolean(rows && rows.length > 0);
  });

  // 5) Determine which positions need market data on which dates.
  const pointerPrepass = new Map<string, number>();
  const eligibleDateIndices = new Set<number>();
  const eligibleDateKeysByPosition = new Map<string, Set<CivilDateKey>>();

  for (let dateIndex = 0; dateIndex < processingDates.length; dateIndex += 1) {
    const dateKey = processingDateKeys[dateIndex];

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

      const quantity = snapshot.quantity ?? 0;
      if (quantity <= 0) continue;

      if (!position.symbol_id && !position.domain_id) continue;

      eligibleDateIndices.add(dateIndex);
      let allowedDates = eligibleDateKeysByPosition.get(position.id);
      if (!allowedDates) {
        allowedDates = new Set<CivilDateKey>();
        eligibleDateKeysByPosition.set(position.id, allowedDates);
      }
      allowedDates.add(dateKey);
    }
  }

  const marketDateIndices = Array.from(eligibleDateIndices).sort(
    (left, right) => left - right,
  );
  const marketDataDates = marketDateIndices.map(
    (index) => processingDates[index],
  );

  const marketEligiblePositions = activePositions.filter((position) => {
    if (!position.symbol_id && !position.domain_id) return false;
    const allowedDates = eligibleDateKeysByPosition.get(position.id);
    return Boolean(allowedDates && allowedDates.size > 0);
  });

  const marketPositionsMinimal = await toMarketDataPositions(
    marketEligiblePositions,
  );

  const eligibleDatesForHandlers = new Map<string, Set<string>>();
  marketEligiblePositions.forEach((position) => {
    const allowedDates = eligibleDateKeysByPosition.get(position.id);
    if (allowedDates?.size) {
      eligibleDatesForHandlers.set(position.id, new Set(allowedDates));
    }
  });

  let marketPricesByPositionDate = new Map<string, number>();
  if (marketPositionsMinimal.length && marketDataDates.length) {
    marketPricesByPositionDate = await fetchMarketDataRange(
      marketPositionsMinimal,
      marketDataDates,
      {
        upsert: true,
        eligibleDates: eligibleDatesForHandlers,
        // Range history opts into read repair only after cached fallback
        // coverage is exhausted inside fetchQuotes().
        liveFetchOnMiss: true,
      },
    );
  }

  // 6) Fetch FX rates for all required currencies and dates.
  const currencies = new Set<string>([resolvedTargetCurrency]);
  activePositions.forEach((position) => currencies.add(position.currency));

  const fxRequests: { currency: string; date: Date }[] = [];
  const fxDedup = new Set<string>();
  for (const currency of currencies) {
    for (
      let dateIndex = 0;
      dateIndex < processingDates.length;
      dateIndex += 1
    ) {
      const dateKey = processingDateKeys[dateIndex];
      const dedupKey = `${currency}|${dateKey}`;
      if (fxDedup.has(dedupKey)) continue;
      fxDedup.add(dedupKey);
      fxRequests.push({ currency, date: processingDates[dateIndex] });
    }
  }

  const fxMap = await fetchExchangeRates(fxRequests);

  // 7) Synthesize daily local valuations from snapshots + market prices.
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
    startDateKey: processingDateKeys[0],
    endDateKey: processingDateKeys[processingDateKeys.length - 1],
    marketPricesByPositionDate,
    includeZeroQuantityRows: true,
  });

  const dailyRowsLookupByPosition = new Map<
    string,
    Map<string, DailyValuationRow>
  >();

  dailyRowsByPosition.forEach((rows, positionId) => {
    dailyRowsLookupByPosition.set(
      positionId,
      new Map(rows.map((row) => [row.dateKey, row])),
    );
  });

  const history: NetWorthHistoryData[] = [];

  for (let dateIndex = 0; dateIndex < processingDates.length; dateIndex += 1) {
    const date = processingDates[dateIndex];
    const dateKey = processingDateKeys[dateIndex];
    let total = 0;
    let taxTotal = 0;

    for (const position of activePositions) {
      const dailyRow =
        dailyRowsLookupByPosition.get(position.id)?.get(dateKey) ?? null;
      if (!dailyRow) continue;

      const localValue = dailyRow.totalValue;
      total += convertCurrency(
        localValue,
        position.currency,
        resolvedTargetCurrency,
        fxMap,
        dateKey,
      );

      if (mode === "after_capital_gains") {
        // Fallback to snapshot unit value when basis was never explicitly set.
        const basisPerUnit =
          dailyRow.costBasisPerUnit ?? dailyRow.snapshotUnitValue ?? 0;
        const totalCostBasis = basisPerUnit * dailyRow.quantity;
        const localTax = calculateCapitalGainsTaxAmount({
          positionType: position.type,
          capitalGainsTaxRate: position.capital_gains_tax_rate,
          unrealizedGain: localValue - totalCostBasis,
        });
        if (localTax <= 0) continue;

        taxTotal += convertCurrency(
          localTax,
          position.currency,
          resolvedTargetCurrency,
          fxMap,
          dateKey,
        );
      }
    }

    history.push({
      date,
      dateKey,
      value: mode === "after_capital_gains" ? total - taxTotal : total,
    });
  }

  if (paddingCount > 0) {
    return [
      ...mapDateKeysToZeroHistory(dateKeys.slice(0, paddingCount)),
      ...history,
    ];
  }

  return history;
}
