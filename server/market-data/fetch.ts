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
 * Optional include flags. Defaults are all ON.
 * - marketPrices: controls quotes + domain valuations (and future market-backed types)
 * - exchangeRates: controls FX
 */
interface IncludeOptions {
  marketPrices?: boolean;
  exchangeRates?: boolean;
}

/**
 * Collect all market data requests from holdings for a specific date and target currency.
 * This centralizes the logic for gathering quote, domain valuation, and exchange rate requests.
 */
function collectMarketDataRequests(
  holdings: TransformedHolding[],
  date: Date,
  targetCurrency: string | undefined,
  include: IncludeOptions,
): MarketDataRequests {
  // 1. Collect quote requests for symbol holdings
  const quoteRequests: Array<{ symbolId: string; date: Date }> = [];
  if (include.marketPrices !== false) {
    holdings.forEach((holding) => {
      if (holding.symbol_id) {
        quoteRequests.push({
          symbolId: holding.symbol_id,
          date: date,
        });
      }
    });
  }

  // 2. Collect domain valuation requests for domain holdings
  const domainRequests: Array<{ domain: string; date: Date }> = [];
  if (include.marketPrices !== false) {
    holdings.forEach((holding) => {
      if (holding.domain_id) {
        domainRequests.push({
          domain: holding.domain_id,
          date: date,
        });
      }
    });
  }

  // 3. Collect exchange rate requests for all currencies
  let exchangeRequests: Array<{ currency: string; date: Date }> = [];
  if (include.exchangeRates !== false) {
    const uniqueCurrencies = new Set<string>();
    holdings.forEach((holding) => {
      uniqueCurrencies.add(holding.currency);
    });
    if (targetCurrency) {
      uniqueCurrencies.add(targetCurrency);
    }

    exchangeRequests = Array.from(uniqueCurrencies).map((currency) => ({
      currency,
      date: date,
    }));
  }

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

  // Collect requests (skip building for disabled resources)
  const requests = collectMarketDataRequests(
    holdings,
    date,
    targetCurrency,
    include,
  );

  // Bulk fetch only what is requested
  const [quotesMap, domainValuationsMap, exchangeRatesMap] = await Promise.all([
    include.marketPrices === false || requests.quotes.length === 0
      ? Promise.resolve(new Map())
      : fetchQuotes(requests.quotes, options.upsert),
    include.marketPrices === false || requests.domains.length === 0
      ? Promise.resolve(new Map())
      : fetchDomainValuations(requests.domains, options.upsert),
    include.exchangeRates === false || requests.exchangeRates.length === 0
      ? Promise.resolve(new Map())
      : fetchExchangeRates(requests.exchangeRates),
  ]);

  return {
    quotes: quotesMap,
    domainValuations: domainValuationsMap,
    exchangeRates: exchangeRatesMap,
  };
}
