"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchMarketData } from "@/server/market-data/fetch";
import { convertCurrency } from "@/lib/currency-conversion";

export interface NetWorthHistoryData {
  date: Date;
  value: number;
}

interface FetchNetWorthHistoryParams {
  targetCurrency?: string;
  weeksBack?: number;
}

/**
 * Calculate net worth history over multiple weeks.
 * Uses bulk API calls for optimal performance across all historical dates.
 */
export async function fetchNetWorthHistory({
  targetCurrency,
  weeksBack = 24,
}: FetchNetWorthHistoryParams) {
  // Get user's preferred currency if not specified
  if (!targetCurrency) {
    const { profile } = await fetchProfile();
    targetCurrency = profile.display_currency;
  }

  // Generate weekly date points
  const weeklyDates = generateWeeklyDates(weeksBack);

  // 1. For each date, fetch holdings valued as-of and only FX; compute net worth
  const history = await Promise.all(
    weeklyDates.map(async (date) => {
      const holdingsAsOf = await fetchHoldings({
        includeArchived: true,
        asOfDate: date,
      });

      if (!holdingsAsOf?.length) {
        return { date, value: 0 };
      }

      const { exchangeRates } = await fetchMarketData(
        holdingsAsOf,
        date,
        targetCurrency,
        { include: { marketPrices: false } },
      );

      let total = 0;
      holdingsAsOf.forEach((h) => {
        const converted = convertCurrency(
          h.total_value,
          h.currency,
          targetCurrency!,
          exchangeRates,
          date,
        );
        total += converted;
      });

      return { date, value: total };
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
