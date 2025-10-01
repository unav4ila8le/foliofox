"use server";

import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type { TransformedHolding } from "@/types/global.types";

/**
 * Optional include flags. Defaults are all ON.
 * - marketPrices: controls symbol/domain (and future) price handlers
 * - exchangeRates: controls FX
 */
interface IncludeOptions {
  marketPrices?: boolean;
  exchangeRates?: boolean;
}

/**
 * Fetch market data in bulk for a given set of holdings and date.
 *
 * Defaults: quotes, domains, and exchangeRates are all included unless
 * explicitly disabled via options.include.{...} = false. When
 * include.exchangeRates is false, targetCurrency can be omitted.
 */
export async function fetchMarketData(
  holdings: TransformedHolding[],
  date: Date,
  targetCurrency?: string,
  options: { upsert?: boolean; include?: IncludeOptions } = {},
) {
  const { include = {} } = options;

  // Pluggable handler pipeline for market prices
  const { MARKET_DATA_HANDLERS } = await import(
    "@/server/market-data/sources/registry"
  );

  let quotesMap: Map<string, number> = new Map();
  let domainValuationsMap: Map<string, number> = new Map();

  if (include.marketPrices !== false) {
    const symbolHandler = MARKET_DATA_HANDLERS.find(
      (h) => h.source === "symbol",
    );
    if (symbolHandler) {
      const requests = symbolHandler.collectRequests(holdings, date);
      quotesMap = requests.length
        ? await symbolHandler.fetchData(requests, { upsert: options.upsert })
        : new Map();
    }

    const domainHandler = MARKET_DATA_HANDLERS.find(
      (h) => h.source === "domain",
    );
    if (domainHandler) {
      const requests = domainHandler.collectRequests(holdings, date);
      domainValuationsMap = requests.length
        ? await domainHandler.fetchData(requests, {
            upsert: options.upsert ?? true,
          })
        : new Map();
    }
  }

  // Exchange rates
  let exchangeRatesMap: Map<string, number> = new Map();
  if (include.exchangeRates !== false) {
    const uniqueCurrencies = new Set<string>();
    holdings.forEach((h) => uniqueCurrencies.add(h.currency));
    if (targetCurrency) uniqueCurrencies.add(targetCurrency);

    const exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date,
    }));

    exchangeRatesMap =
      exchangeRequests.length === 0
        ? new Map()
        : await fetchExchangeRates(exchangeRequests);
  }

  return {
    quotes: quotesMap,
    domainValuations: domainValuationsMap,
    exchangeRates: exchangeRatesMap,
  };
}
