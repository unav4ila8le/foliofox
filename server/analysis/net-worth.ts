"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRate } from "@/server/exchange-rates/fetch";

import { createClient } from "@/utils/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Holding } from "@/types/global.types";

// Calculate total net worth in specified target currency at a specific date
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(), // Defaults to current date
): Promise<number> {
  const supabase = await createClient();
  const holdings = await fetchHoldings({ includeArchived: true });

  if (!holdings?.length) return 0;

  let netWorth = 0;

  for (const holding of holdings) {
    try {
      const { valuationData, quantityData } = await fetchHistoricalData(
        holding,
        date,
        supabase,
      );
      const holdingValue = (valuationData || 0) * (quantityData || 0);

      const convertedValue = await convertToTargetCurrency(
        holdingValue,
        holding.currency,
        targetCurrency,
        date,
      );

      netWorth += convertedValue;
    } catch (error) {
      console.error(
        `Error calculating value for holding ${holding.id}:`,
        error,
      );
    }
  }

  return netWorth;
}

// Helper function to fetch historical data
async function fetchHistoricalData(
  holding: Holding,
  date: Date,
  supabase: SupabaseClient,
) {
  // Get the most recent record for this holding at or before the specified date
  const { data: record } = await supabase
    .from("records")
    .select("unit_value, quantity")
    .eq("holding_id", holding.id)
    .lte("date", date.toISOString())
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    valuationData: record?.unit_value,
    quantityData: record?.quantity,
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
