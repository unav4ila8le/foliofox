"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchProfile } from "@/server/profile/actions";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
import {
  fetchMarketDataRange,
  toMarketDataPositions,
} from "@/server/market-data/fetch";
import { calculateCapitalGainsTaxAmount } from "@/server/analysis/net-worth/capital-gains-tax";
import { convertCurrency } from "@/lib/currency-conversion";
import {
  addUTCDays,
  formatUTCDateKey,
  startOfUTCDay,
} from "@/lib/date/date-utils";
import type { NetWorthMode } from "@/server/analysis/net-worth/types";

export interface NetWorthHistoryData {
  date: Date;
  value: number;
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
  if (!targetCurrency) {
    const { profile } = await fetchProfile();
    targetCurrency = profile.display_currency;
  }

  // Validate and enforce minimum daysBack
  const totalDaysBack = Math.max(1, Math.trunc(daysBack));

  const end = startOfUTCDay(new Date());
  const endDateKey = formatUTCDateKey(end);
  const start = addUTCDays(end, -(totalDaysBack - 1));
  const dates: Date[] = Array.from({ length: totalDaysBack }, (_, index) =>
    addUTCDays(start, index),
  );
  const dateKeys = dates.map((date) => formatUTCDateKey(date));
  const mapDatesToZeroHistory = (dateList: Date[]) =>
    dateList.map((date) => ({ date, value: 0 }));

  const { user, supabase } = await getCurrentUser();

  // 1) Fetch positions once (include archived by not filtering archived_at)
  const { data: positions, error: positionsError } = await supabase
    .from("positions")
    .select(
      "id, currency, symbol_id, domain_id, user_id, type, capital_gains_tax_rate",
    )
    .eq("user_id", user.id);

  if (positionsError) throw new Error(positionsError.message);

  if (!positions?.length) {
    return mapDatesToZeroHistory(dates);
  }

  const positionIds = positions.map((p) => p.id);

  // 2) Fetch all snapshots for the full range once
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("position_snapshots")
    .select(
      "position_id, date, quantity, unit_value, created_at, cost_basis_per_unit",
    )
    .eq("user_id", user.id)
    .in("position_id", positionIds)
    .lte("date", endDateKey)
    .order("position_id")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (snapshotsError) {
    throw new Error(snapshotsError.message);
  }

  if (!snapshots || !snapshots.length) {
    return mapDatesToZeroHistory(dates);
  }

  const snapshotsByPosition = new Map<
    string,
    {
      date: string;
      quantity: number;
      unit_value: number;
      cost_basis_per_unit: number | null;
    }[]
  >();
  snapshots.forEach((s) => {
    const arr = snapshotsByPosition.get(s.position_id) || [];
    arr.push({
      date: s.date,
      quantity: s.quantity,
      unit_value: s.unit_value,
      cost_basis_per_unit: s.cost_basis_per_unit ?? null,
    });
    snapshotsByPosition.set(s.position_id, arr);
  });

  const earliestSnapshotDate = snapshots.reduce<string | null>((min, snap) => {
    if (!snap.date) return min;
    if (!min || snap.date < min) return snap.date;
    return min;
  }, null);

  let processingDates = dates;
  let processingDateKeys = dateKeys;
  let paddingCount = 0;

  if (earliestSnapshotDate) {
    const firstActiveIndex = dateKeys.findIndex(
      (dateKey) => dateKey >= earliestSnapshotDate,
    );

    if (firstActiveIndex === -1) {
      return mapDatesToZeroHistory(dates);
    }

    if (firstActiveIndex > 0) {
      paddingCount = firstActiveIndex;
      processingDates = dates.slice(firstActiveIndex);
      processingDateKeys = dateKeys.slice(firstActiveIndex);
    }
  }

  if (!processingDates.length) {
    return mapDatesToZeroHistory(dates);
  }

  const activePositions = positions.filter((position) => {
    const snaps = snapshotsByPosition.get(position.id);
    return Boolean(snaps && snaps.length > 0);
  });

  // 3) Determine which positions need market data on which dates
  const pointerPrepass = new Map<string, number>();
  const eligibleDateIndices = new Set<number>();
  const eligibleDateKeysByPosition = new Map<string, Set<string>>();

  for (let dateIdx = 0; dateIdx < processingDates.length; dateIdx += 1) {
    const dateKey = processingDateKeys[dateIdx];

    for (const position of activePositions) {
      const snaps = snapshotsByPosition.get(position.id);
      if (!snaps?.length) continue;

      let idx = pointerPrepass.get(position.id) ?? 0;
      while (idx + 1 < snaps.length && snaps[idx + 1].date <= dateKey) {
        idx += 1;
      }
      pointerPrepass.set(position.id, idx);

      const snapshot = snaps[idx];
      if (!snapshot || snapshot.date > dateKey) continue;

      const quantity = snapshot.quantity ?? 0;
      if (quantity <= 0) continue;

      if (!position.symbol_id && !position.domain_id) continue;

      eligibleDateIndices.add(dateIdx);
      let allowedDates = eligibleDateKeysByPosition.get(position.id);
      if (!allowedDates) {
        allowedDates = new Set<string>();
        eligibleDateKeysByPosition.set(position.id, allowedDates);
      }
      allowedDates.add(dateKey);
    }
  }

  const marketDateIndices = Array.from(eligibleDateIndices).sort(
    (a, b) => a - b,
  );
  const marketDataDates = marketDateIndices.map((idx) => processingDates[idx]);

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
    const allowed = eligibleDateKeysByPosition.get(position.id);
    if (allowed?.size) {
      eligibleDatesForHandlers.set(position.id, allowed);
    }
  });

  let marketPricesByPositionDate = new Map<string, number>();
  if (marketPositionsMinimal.length && marketDataDates.length) {
    marketPricesByPositionDate = await fetchMarketDataRange(
      marketPositionsMinimal,
      marketDataDates,
      { upsert: true, eligibleDates: eligibleDatesForHandlers },
    );
  }

  // 4) FX for all currencies and dates (dedup requests)
  const currencies = new Set<string>([targetCurrency!]);
  activePositions.forEach((p) => currencies.add(p.currency));

  const fxRequests: { currency: string; date: Date }[] = [];
  const fxDedup = new Set<string>();
  for (const currency of currencies) {
    for (let dateIdx = 0; dateIdx < processingDates.length; dateIdx += 1) {
      const dateKey = processingDateKeys[dateIdx];
      const dedupKey = `${currency}|${dateKey}`;
      if (fxDedup.has(dedupKey)) continue;
      fxDedup.add(dedupKey);
      fxRequests.push({ currency, date: processingDates[dateIdx] });
    }
  }

  const fxMap = await fetchExchangeRates(fxRequests);

  // 5) Compute daily values using two-pointer per position to find latest snapshot <= date
  const indexByPosition = new Map<string, number>();
  // Track the latest explicit basis encountered up to each date.
  const basisByPosition = new Map<string, number | null>();
  const history: NetWorthHistoryData[] = [];

  for (let dateIdx = 0; dateIdx < processingDates.length; dateIdx += 1) {
    const date = processingDates[dateIdx];
    const dateKey = processingDateKeys[dateIdx];
    let total = 0;
    let taxTotal = 0;

    for (const position of activePositions) {
      const snaps = snapshotsByPosition.get(position.id);
      if (!snaps?.length) continue;

      let idx = indexByPosition.get(position.id) ?? 0;
      let lastExplicitBasis = basisByPosition.get(position.id) ?? null;
      while (idx + 1 < snaps.length && snaps[idx + 1].date <= dateKey) {
        idx += 1;
        const nextSnapshot = snaps[idx];
        // Persist basis across price-only snapshots with null cost basis.
        if (nextSnapshot?.cost_basis_per_unit != null) {
          lastExplicitBasis = nextSnapshot.cost_basis_per_unit;
        }
      }
      indexByPosition.set(position.id, idx);

      const snapshot = snaps[idx];
      if (!snapshot || snapshot.date > dateKey) continue;
      if (snapshot.cost_basis_per_unit != null) {
        lastExplicitBasis = snapshot.cost_basis_per_unit;
      }
      basisByPosition.set(position.id, lastExplicitBasis);

      const marketKey = `${position.id}|${dateKey}`;
      const marketUnit = marketPricesByPositionDate.get(marketKey);
      const unitValue =
        marketUnit !== undefined ? marketUnit : (snapshot.unit_value ?? 0);

      const quantity = snapshot.quantity ?? 0;
      const localValue = quantity * unitValue;
      total += convertCurrency(
        localValue,
        position.currency,
        targetCurrency!,
        fxMap,
        dateKey,
      );

      if (mode === "after_capital_gains") {
        // Fallback to snapshot unit value when basis was never explicitly set.
        const basisPerUnit = lastExplicitBasis ?? snapshot.unit_value ?? 0;
        const totalCostBasis = basisPerUnit * quantity;
        const localTax = calculateCapitalGainsTaxAmount({
          positionType: position.type,
          capitalGainsTaxRate: position.capital_gains_tax_rate,
          unrealizedGain: localValue - totalCostBasis,
        });
        if (localTax <= 0) continue;

        taxTotal += convertCurrency(
          localTax,
          position.currency,
          targetCurrency!,
          fxMap,
          dateKey,
        );
      }
    }

    history.push({
      date,
      value: mode === "after_capital_gains" ? total - taxTotal : total,
    });
  }

  if (paddingCount > 0) {
    const paddedHistory = [
      ...dates.slice(0, paddingCount).map((date) => ({ date, value: 0 })),
      ...history,
    ];
    return paddedHistory;
  }

  return history;
}
