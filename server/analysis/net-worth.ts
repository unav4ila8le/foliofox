"use server";

import { format } from "date-fns";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchDomainValuations } from "@/server/domain-valuations/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import { convertCurrency } from "@/lib/currency-conversion";

import type { Record } from "@/types/global.types";

/**
 * Calculate total net worth in specified target currency at a specific date.
 * Uses bulk API calls for optimal performance.
 */
export async function calculateNetWorth(
  targetCurrency: string,
  date: Date = new Date(),
) {
  const { holdings, records: recordsByHolding } = await fetchHoldings({
    includeArchived: true,
    includeRecords: true,
  });

  // If no holdings, return 0
  if (!holdings?.length) return 0;

  // 1. Collect all requests we need to make
  const quoteRequests: Array<{ symbolId: string; date: Date }> = [];
  const domainRequests: Array<{ domain: string; date: Date }> = [];

  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      quoteRequests.push({
        symbolId: holding.symbol_id,
        date: date,
      });
    }
    if (holding.domain_id) {
      domainRequests.push({
        domain: holding.domain_id,
        date: date,
      });
    }
  });

  // Collect unique currencies we need exchange rates for
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((holding) => {
    uniqueCurrencies.add(holding.currency);
  });
  uniqueCurrencies.add(targetCurrency);

  // Create exchange rate requests for unique currencies only
  const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
    currency,
    date: date,
  }));

  // 2. Make bulk requests in parallel
  const [quotesMap, domainValuationsMap, exchangeRatesMap] = await Promise.all([
    // Bulk fetch all quotes
    quoteRequests.length > 0 ? fetchQuotes(quoteRequests) : new Map(),

    // Bulk fetch all domain valuations
    domainRequests.length > 0
      ? fetchDomainValuations(domainRequests)
      : new Map(),

    // Bulk fetch all exchange rates
    exchangeRequests.length > 0
      ? fetchExchangeRates(exchangeRequests)
      : new Map(),
  ]);

  // 3. Process historical records (already fetched by fetchHoldings)
  const latestRecords = new Map<
    string,
    Pick<
      Record,
      "holding_id" | "unit_value" | "quantity" | "date" | "created_at"
    >
  >();

  // Filter records by date and get the latest for each holding
  holdings.forEach((holding) => {
    const holdingRecords = recordsByHolding.get(holding.id) || [];
    const recordsForDate = holdingRecords.filter(
      (record: Record) => record.date <= format(date, "yyyy-MM-dd"),
    );

    if (recordsForDate.length > 0) {
      latestRecords.set(holding.id, recordsForDate[0]); // First one is latest due to sorting
    }
  });

  // 4. Calculate net worth using bulk data
  let netWorth = 0;

  holdings.forEach((holding) => {
    const record = latestRecords.get(holding.id);
    if (!record) return;

    let unitValue = record.unit_value;

    // Use market data if available
    if (holding.symbol_id) {
      const quoteKey = `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
      const marketPrice = quotesMap.get(quoteKey);
      if (marketPrice) {
        unitValue = marketPrice;
      }
    }

    if (holding.domain_id) {
      const domainKey = `${holding.domain_id}|${format(date, "yyyy-MM-dd")}`;
      const domainValuation = domainValuationsMap.get(domainKey);
      if (domainValuation) {
        unitValue = domainValuation;
      }
    }

    const holdingValue = unitValue * record.quantity;

    // Convert to target currency using shared helper
    const convertedValue = convertCurrency(
      holdingValue,
      holding.currency,
      targetCurrency,
      exchangeRatesMap,
      date,
    );

    netWorth += convertedValue;
  });

  return netWorth;
}
