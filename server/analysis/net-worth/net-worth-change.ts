"use server";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import {
  addCivilDateKeyDays,
  resolveTodayDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";
import type { NetWorthMode } from "@/server/analysis/net-worth/types";

export interface NetWorthChangeData {
  currentDateKey: CivilDateKey;
  previousDateKey: CivilDateKey;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number;
}

interface FetchNetWorthChangeParams {
  targetCurrency?: string;
  daysBack?: number;
  mode?: NetWorthMode;
}

// Fetch net worth change between current date and a past comparison window
export async function fetchNetWorthChange({
  targetCurrency,
  daysBack = 180,
  mode = "gross",
}: FetchNetWorthChangeParams) {
  // 1. Resolve user profile once for both default currency and civil "today".
  const { profile } = await fetchProfile();
  const resolvedTargetCurrency = targetCurrency ?? profile.display_currency;
  const currentDateKey = resolveTodayDateKey(profile.time_zone);

  // 2. Calculate comparison date key in the same civil-day domain.
  const totalDaysBack = Math.max(1, Math.trunc(daysBack));
  const previousDateKey = addCivilDateKeyDays(currentDateKey, -totalDaysBack);

  // 3. Calculate net worth at both dates in parallel.
  const [currentValue, previousValue] = await Promise.all([
    calculateNetWorth(resolvedTargetCurrency, currentDateKey, undefined, mode),
    calculateNetWorth(resolvedTargetCurrency, previousDateKey, undefined, mode),
  ]);

  // 4. Compute deltas for chart/AI consumers.
  const absoluteChange = currentValue - previousValue;
  const percentageChange =
    previousValue !== 0 ? (absoluteChange / previousValue) * 100 : 0;

  return {
    currentDateKey,
    previousDateKey,
    currentValue,
    previousValue,
    absoluteChange,
    percentageChange,
  };
}
