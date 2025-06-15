"use server";

import yahooFinance from "yahoo-finance2";
import { z } from "zod";

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

// Define the response type for our search function
export interface SearchEquitiesResponse {
  success: boolean;
  data?: Equity[];
  message?: string;
}

// Import the Equity type from global types
import type { Equity } from "@/types/global.types";

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().min(1).max(20).optional().default(10),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

/**
 * Search for equities using the Yahoo Finance API
 * @param params Search parameters including query and optional limit
 * @returns Promise<SearchEquitiesResponse>
 */
export async function searchEquities(
  params: SearchParams,
): Promise<SearchEquitiesResponse> {
  try {
    // Validate the input parameters
    const validatedParams = searchParamsSchema.parse(params);

    // Perform the search using yahoo-finance2
    const searchResults = (await yahooFinance.search(validatedParams.query, {
      quotesCount: validatedParams.limit,
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
      }));

    return {
      success: true,
      data: equities,
    };
  } catch (error) {
    console.error("Error searching equities:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to search equities",
    };
  }
}
