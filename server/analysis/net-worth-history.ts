"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";
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

  // 1. For each date, fetch positions valued as-of and FX rates; compute net worth
  const history = await Promise.all(
    weeklyDates.map(async (date) => {
      const positionsAsOf = await fetchPositions({
        includeArchived: true,
        asOfDate: date,
      });

      if (!positionsAsOf?.length) {
        return { date, value: 0 };
      }

      // Fetch exchange rates for this date
      const uniqueCurrencies = new Set<string>();
      positionsAsOf.forEach((p) => uniqueCurrencies.add(p.currency));
      uniqueCurrencies.add(targetCurrency!);

      const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
        currency,
        date,
      }));

      const exchangeRates = await fetchExchangeRates(exchangeRequests);

      // Sum converted values
      let total = 0;
      positionsAsOf.forEach((p) => {
        const converted = convertCurrency(
          p.total_value,
          p.currency,
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
