"use server";

import { format } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { createClient } from "@/utils/supabase/server";

import type { Record } from "@/types/global.types";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(),
) {
  const holdings = await fetchHoldings({ includeArchived: true });

  if (!holdings?.length) return 0;

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

  // 2. Make bulk requests in parallel
  const [quotesMap, exchangeRatesMap] = await Promise.all([
    // Bulk fetch all quotes
    quoteRequests.length > 0 ? fetchQuotes(quoteRequests) : new Map(),

    // Bulk fetch all exchange rates
    exchangeRequests.length > 0
      ? fetchExchangeRates(exchangeRequests)
      : new Map(),
  ]);

  // 3. Bulk fetch historical records and process results
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

  // 4. Calculate net worth using bulk data
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

    const toUsdRate = exchangeRatesMap.get(toUsdKey);
    const fromUsdRate = exchangeRatesMap.get(fromUsdKey);

    const valueInUsd = holdingValue / toUsdRate;
    const convertedValue = valueInUsd * fromUsdRate;

    netWorth += convertedValue;
  });

  return netWorth;
}
