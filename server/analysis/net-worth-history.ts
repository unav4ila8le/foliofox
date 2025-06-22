"use server";

import { calculateNetWorthBulk } from "@/server/analysis/net-worth";

export interface NetWorthHistoryData {
  date: Date;
  value: number;
}

interface FetchNetWorthHistoryParams {
  targetCurrency: string;
  weeksBack?: number;
}

// Fetch net worth history (default 24 weeks back)
export async function fetchNetWorthHistory({
  targetCurrency,
  weeksBack = 24,
}: FetchNetWorthHistoryParams) {
  // Generate weekly date points
  const weeklyDates = generateWeeklyDates(weeksBack);

  // Calculate net worth for each weekly date
  const history = await Promise.all(
    weeklyDates.map(async (date) => {
      const netWorth = await calculateNetWorthBulk(targetCurrency, date);

      return {
        date: date,
        value: netWorth,
      };
    }),
  );

  return history;
}

// Helper function to generate weekly dates
function generateWeeklyDates(weeksBack: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();

  // Simply go back 7 days at a time from today
  for (let i = 0; i < weeksBack; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - i * 7);
    dates.unshift(weekDate); // Add to beginning so dates are chronological
  }

  return dates;
}
