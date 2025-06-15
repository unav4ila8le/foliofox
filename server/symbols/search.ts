"use server";

import yahooFinance from "yahoo-finance2";
import { z } from "zod";

import type { Symbol } from "@/types/global.types";

// Define the expected structure from yahoo-finance2 search results
interface YahooSearchSymbol {
  symbol: string;
  quoteType?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  exchange?: string;
  industry?: string;
  sector?: string;
}

interface YahooSearchSymbolResult {
  quotes: YahooSearchSymbol[];
}

// Define the response type for our search function
export interface SearchInstrumentsResponse {
  success: boolean;
  data?: Symbol[];
  message?: string;
}

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().min(1).max(20).optional().default(10),
  quoteType: z.string().optional(),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

/**
 * Search for symbols using the Yahoo Finance API
 * @param params Search parameters including query and optional limit
 * @returns Promise<SearchSymbolsResponse>
 */
export async function searchSymbols(params: SearchParams) {
  try {
    // Validate the input parameters
    const validatedParams = searchParamsSchema.parse(params);

    // Perform the search using yahoo-finance2
    const searchResults = (await yahooFinance.search(validatedParams.query, {
      quotesCount: validatedParams.limit,
      newsCount: 0,
      enableFuzzyQuery: true,
    })) as YahooSearchSymbolResult;

    // Filter and transform the results to match Symbol type
    const symbols: Symbol[] = searchResults.quotes
      .filter(
        (quote) => !params.quoteType || quote.quoteType === params.quoteType,
      )
      .map((quote) => ({
        id: quote.symbol,
        quote_type: quote.quoteType || "",
        name: quote.shortname || quote.longname || quote.symbol,
        short_name: quote.shortname || null,
        long_name: quote.longname || null,
        exchange: quote.exchDisp || quote.exchange || null,
        industry: quote.industry || null,
        sector: quote.sector || null,
      }));

    return {
      success: true,
      data: symbols,
    };
  } catch (error) {
    console.error("Error searching symbols:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to search symbols",
    };
  }
}
