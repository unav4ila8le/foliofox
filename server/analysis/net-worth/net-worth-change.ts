"use server";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { addUTCDays, startOfUTCDay } from "@/lib/date/date-utils";

export interface NetWorthChangeData {
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number;
}

interface FetchNetWorthChangeParams {
  targetCurrency?: string;
  daysBack?: number;
}

// Fetch net worth change between current date and a past comparison window
export async function fetchNetWorthChange({
  targetCurrency,
  daysBack = 180,
}: FetchNetWorthChangeParams) {
  // Get user's preferred currency if not specified
  if (!targetCurrency) {
    const { profile } = await fetchProfile();
    targetCurrency = profile.display_currency;
  }

  // Calculate comparison date
  const totalDaysBack = Math.max(1, Math.trunc(daysBack));
  const today = startOfUTCDay(new Date());
  const comparisonDate = addUTCDays(today, -totalDaysBack);

  // Calculate net worth at both dates in parallel
  const [currentValue, previousValue] = await Promise.all([
    calculateNetWorth(targetCurrency), // Current (defaults to today)
    calculateNetWorth(targetCurrency, comparisonDate), // Historical
  ]);

  // Calculate changes
  const absoluteChange = currentValue - previousValue;
  const percentageChange =
    previousValue !== 0 ? (absoluteChange / previousValue) * 100 : 0;

  return {
    currentValue,
    previousValue,
    absoluteChange,
    percentageChange,
  };
}
