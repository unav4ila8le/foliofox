"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRate } from "@/server/exchange-rates/fetch";

import { createClient } from "@/utils/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Holding } from "@/types/global.types";

interface NetWorthHistoryPoint {
  date: Date;
  value: number; // Net worth in target currency
}

interface FetchNetWorthHistoryParams {
  targetCurrency: string;
  weeksBack?: number; // How many weeks to go back
}

// Fetch net worth history (default 24 weeks back)
export async function fetchNetWorthHistory({
  targetCurrency,
  weeksBack = 24,
}: FetchNetWorthHistoryParams): Promise<NetWorthHistoryPoint[]> {
  const supabase = await createClient();

  // Get all holdings
  const holdings = await fetchHoldings({ includeArchived: true });

  // Generate weekly date points
  const weeklyDates = generateWeeklyDates(weeksBack);

  // Calculate net worth for each weekly date
  const history = await Promise.all(
    weeklyDates.map(async (date) => {
      const netWorth = await calculateNetWorthAtDate(
        holdings,
        date,
        targetCurrency,
        supabase,
      );

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

// Helper function to fetch historical data
async function fetchHistoricalData(
  holding: Holding,
  date: Date,
  supabase: SupabaseClient,
) {
  // Get latest valuation and quantity on or before the target date
  const [valuationResponse, quantityResponse] = await Promise.all([
    supabase
      .from("holding_valuations")
      .select("value")
      .eq("holding_id", holding.id)
      .lte("date", date.toISOString())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("holding_quantities")
      .select("quantity")
      .eq("holding_id", holding.id)
      .lte("date", date.toISOString())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    valuationData: valuationResponse.data,
    quantityData: quantityResponse.data,
  };
}

// Helper function for currency conversion
async function convertToTargetCurrency(
  value: number,
  fromCurrency: string,
  toCurrency: string,
  date: Date,
) {
  // Convert to USD first
  const toUsdRate = await fetchExchangeRate(fromCurrency, date);
  const valueInUsd = value / toUsdRate;

  // Then to target currency
  const fromUsdRate = await fetchExchangeRate(toCurrency, date);
  return valueInUsd * fromUsdRate;
}

// Calculate net worth at a specific date
async function calculateNetWorthAtDate(
  holdings: Holding[],
  date: Date,
  targetCurrency: string,
  supabase: SupabaseClient,
): Promise<number> {
  if (!holdings?.length) return 0; // No holdings = zero net worth

  let totalNetWorth = 0;

  for (const holding of holdings) {
    try {
      const { valuationData, quantityData } = await fetchHistoricalData(
        holding,
        date,
        supabase,
      );

      const holdingValue =
        (valuationData?.value || 0) * (quantityData?.quantity || 0);
      const convertedValue = await convertToTargetCurrency(
        holdingValue,
        holding.currency,
        targetCurrency,
        date,
      );

      totalNetWorth += convertedValue;
    } catch (error) {
      console.error(
        `Error calculating value for holding ${holding.id}:`,
        error,
      );
    }
  }

  return totalNetWorth;
}
