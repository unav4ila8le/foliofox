"use server";

import { calculateNetWorthBulk } from "@/server/analysis/net-worth";

export interface NetWorthChangeData {
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number;
}

interface FetchNetWorthChangeParams {
  targetCurrency: string;
  weeksBack?: number;
}

// Fetch net worth change between current date and weeksBack ago
export async function fetchNetWorthChange({
  targetCurrency,
  weeksBack = 24,
}: FetchNetWorthChangeParams) {
  // Calculate comparison date
  const today = new Date();
  const comparisonDate = new Date(today);
  comparisonDate.setDate(today.getDate() - weeksBack * 7);

  // Calculate net worth at both dates in parallel
  const [currentValue, previousValue] = await Promise.all([
    calculateNetWorthBulk(targetCurrency), // Current (defaults to today)
    calculateNetWorthBulk(targetCurrency, comparisonDate), // Historical
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
