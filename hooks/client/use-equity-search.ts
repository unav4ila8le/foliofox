"use client";

import { useState } from "react";
import yahooFinance from "yahoo-finance2";

import type { Equity } from "@/types/global.types";

// Define the expected structure from yahoo-finance2 search results
interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  exchange?: string;
  industry?: string;
  sector?: string;
}

interface YahooSearchResult {
  quotes: YahooSearchQuote[];
}

export function useEquitySearch() {
  const [results, setResults] = useState<Equity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchEquities = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const searchResults = (await yahooFinance.search(query, {
        quotesCount: 10,
        newsCount: 0,
        enableFuzzyQuery: true,
      })) as YahooSearchResult;

      // Filter and transform the results to match your Equity type
      const equities: Equity[] = searchResults.quotes
        .filter(
          (quote): quote is YahooSearchQuote =>
            quote?.quoteType === "EQUITY" && Boolean(quote.symbol),
        )
        .map((quote) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || quote.symbol,
          short_name: quote.shortname || null,
          long_name: quote.longname || null,
          exchange: quote.exchDisp || quote.exchange || null,
          industry: quote.industry || null,
          sector: quote.sector || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

      setResults(equities);
    } catch (error) {
      console.error("Error searching equities:", error);
      throw new Error(
        `Error searching equities: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    results,
    isLoading,
    searchEquities,
  };
}
