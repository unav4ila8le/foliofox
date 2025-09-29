"use server";

import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchDomainValuations } from "@/server/domain-valuations/fetch";
import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

import type { TransformedHolding } from "@/types/global.types";

export interface MarketDataRequests {
  quotes: Array<{ symbolId: string; date: Date }>;
  domains: Array<{ domain: string; date: Date }>;
  exchangeRates: Array<{ currency: string; date: Date }>;
}

/**
 * Collect all market data requests from holdings for a specific date and target currency.
 * This centralizes the logic for gathering quote, domain valuation, and exchange rate requests.
 */
function collectMarketDataRequests(
  holdings: TransformedHolding[],
  date: Date,
  targetCurrency: string,
): MarketDataRequests {
  // 1. Collect quote requests for symbol holdings
  const quoteRequests: Array<{ symbolId: string; date: Date }> = [];
  holdings.forEach((holding) => {
    if (holding.symbol_id) {
      quoteRequests.push({
        symbolId: holding.symbol_id,
        date: date,
      });
    }
  });

  // 2. Collect domain valuation requests for domain holdings
  const domainRequests: Array<{ domain: string; date: Date }> = [];
  holdings.forEach((holding) => {
    if (holding.domain_id) {
      domainRequests.push({
        domain: holding.domain_id,
        date: date,
      });
    }
  });

  // 3. Collect exchange rate requests for all currencies
  const uniqueCurrencies = new Set<string>();
  holdings.forEach((holding) => {
    uniqueCurrencies.add(holding.currency);
  });
  uniqueCurrencies.add(targetCurrency);

  const exchangeRequests: Array<{ currency: string; date: Date }> = Array.from(
    uniqueCurrencies,
  ).map((currency) => ({
    currency,
    date: date,
  }));

  return {
    quotes: quoteRequests,
    domains: domainRequests,
    exchangeRates: exchangeRequests,
  };
}

/**
 * Fetch all market data (quotes, domain valuations, exchange rates) for holdings in bulk.
 * This centralizes the common pattern of collecting requests and bulk fetching market data.
 */
export async function fetchMarketData(
  holdings: TransformedHolding[],
  date: Date,
  targetCurrency: string,
  options: { upsert?: boolean } = {},
) {
  // Collect all requests
  const requests = collectMarketDataRequests(holdings, date, targetCurrency);

  // Bulk fetch everything
  const [quotesMap, domainValuationsMap, exchangeRatesMap] = await Promise.all([
    requests.quotes.length > 0
      ? fetchQuotes(requests.quotes, options.upsert)
      : new Map(),
    requests.domains.length > 0
      ? fetchDomainValuations(requests.domains, options.upsert)
      : new Map(),
    requests.exchangeRates.length > 0
      ? fetchExchangeRates(requests.exchangeRates)
      : new Map(),
  ]);

  return {
    quotes: quotesMap,
    domainValuations: domainValuationsMap,
    exchangeRates: exchangeRatesMap,
  };
}
