"use server";

import { format } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuote, fetchMultipleQuotes } from "@/server/quotes/fetch";
import {
  fetchExchangeRate,
  fetchMultipleExchangeRates,
} from "@/server/exchange-rates/fetch";

import { createClient } from "@/utils/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Holding } from "@/types/global.types";
import type { Record } from "@/types/global.types";

// Calculate total net worth in specified target currency at a specific date
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(),
) {
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
    .lte("date", format(date, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let valuationData = record?.unit_value;

  // If the holding has a symbol, use the market price for that date
  if (holding.symbol_id) {
    try {
      valuationData = await fetchQuote(holding.symbol_id, date);
    } catch (error) {
      // If fetching the quote fails, fall back to the record value
      console.warn(
        `Failed to fetch quote for symbol ${holding.symbol_id} on ${date}:`,
        error,
      );
    }
  }

  return {
    valuationData,
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

// 🚀 OPTIMIZED: Bulk version of calculateNetWorth
export async function calculateNetWorthBulk(
  targetCurrency: string,
  date: Date = new Date(),
) {
  console.log("🚀 Starting bulk net worth calculation...");

  const holdings = await fetchHoldings({ includeArchived: true });

  if (!holdings?.length) return 0;

  console.log(
    `📊 Processing ${holdings.length} holdings for ${date.toISOString().split("T")[0]}`,
  );

  // 1. Collect all requests we need to make
  const quoteRequests: Array<{ symbolId: string; date: Date }> = [];
  const exchangeRequests: Array<{ currency: string; date: Date }> = [];

  // Collect quote requests (only for holdings with symbols)
  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      quoteRequests.push({
        symbolId: holding.symbol_id,
        date: date,
      });
    }
  });

  // Collect exchange rate requests (for each holding's currency + target currency)
  holdings.forEach((holding) => {
    exchangeRequests.push({
      currency: holding.currency,
      date: date,
    });

    exchangeRequests.push({
      currency: targetCurrency,
      date: date,
    });
  });

  console.log(
    `📈 Need to fetch ${quoteRequests.length} quotes and ${exchangeRequests.length} exchange rates`,
  );

  // 2. Make bulk requests in parallel
  console.log("⚡ Making bulk API calls...");

  const startTime = Date.now();

  const [quotesMap, exchangeRatesMap] = await Promise.all([
    // Bulk fetch all quotes
    quoteRequests.length > 0 ? fetchMultipleQuotes(quoteRequests) : new Map(),

    // Bulk fetch all exchange rates
    exchangeRequests.length > 0
      ? fetchMultipleExchangeRates(exchangeRequests)
      : new Map(),
  ]);

  const endTime = Date.now();
  console.log(`⚡ Bulk API calls completed in ${endTime - startTime}ms`);
  console.log(
    `📈 Got ${quotesMap.size} quotes and ${exchangeRatesMap.size} exchange rates`,
  );

  // 3. Fetch historical records and process results
  console.log("📊 Fetching historical records...");

  const supabase = await createClient();
  const holdingIds = holdings.map((h) => h.id);

  // Bulk fetch historical records for all holdings
  const { data: allRecords } = await supabase
    .from("records")
    .select("holding_id, unit_value, quantity, date, created_at")
    .in("holding_id", holdingIds)
    .lte("date", format(date, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  // Group records by holding_id and get the latest for each
  const latestRecords = new Map<
    string,
    Pick<
      Record,
      "holding_id" | "unit_value" | "quantity" | "date" | "created_at"
    >
  >();
  allRecords?.forEach((record) => {
    if (!latestRecords.has(record.holding_id)) {
      latestRecords.set(record.holding_id, record);
    }
  });

  console.log(`📊 Found records for ${latestRecords.size} holdings`);

  // Calculate net worth using bulk data
  let netWorth = 0;

  holdings.forEach((holding) => {
    const record = latestRecords.get(holding.id);
    if (!record) return;

    let unitValue = record.unit_value;

    // Use market quote if available
    if (holding.symbol_id) {
      const quoteKey = `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
      const marketPrice = quotesMap.get(quoteKey);
      if (marketPrice) {
        unitValue = marketPrice;
      }
    }

    const holdingValue = unitValue * record.quantity;

    // Convert to target currency using bulk exchange rates
    const toUsdKey = `${holding.currency}|${format(date, "yyyy-MM-dd")}`;
    const fromUsdKey = `${targetCurrency}|${format(date, "yyyy-MM-dd")}`;

    const toUsdRate = exchangeRatesMap.get(toUsdKey) || 1;
    const fromUsdRate = exchangeRatesMap.get(fromUsdKey) || 1;

    const valueInUsd = holdingValue / toUsdRate;
    const convertedValue = valueInUsd * fromUsdRate;

    netWorth += convertedValue;
  });

  console.log(
    `💰 Calculated net worth: ${netWorth.toFixed(2)} ${targetCurrency}`,
  );

  console.log("🚀 Bulk net worth calculation completed!");
  return netWorth;
}
