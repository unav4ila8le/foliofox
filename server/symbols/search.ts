"use server";

import yahooFinance from "yahoo-finance2";
import { z } from "zod";

import type { Symbol } from "@/types/global.types";

// Extract the search result type
type SearchResult = Awaited<ReturnType<typeof yahooFinance.search>>;

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().min(1).max(20).optional().default(10),
  quoteTypes: z.array(z.string()).optional(),
});

type SearchParams = z.infer<typeof searchParamsSchema>;
type QuoteResult = SearchResult["quotes"][0];

export async function searchSymbols(params: SearchParams) {
  try {
    // Validate the input parameters
    const validatedParams = searchParamsSchema.parse(params);

    // Perform the search using yahoo-finance2
    const searchResults: SearchResult = await yahooFinance.search(
      validatedParams.query,
      {
        quotesCount: validatedParams.limit,
        newsCount: 0,
        enableFuzzyQuery: true,
      },
    );

    // Filter and transform the results to match Symbol type
    const symbols: Symbol[] = searchResults.quotes
      .filter((quote: QuoteResult) => {
        // If no quote types specified, include all
        if (
          !validatedParams.quoteTypes ||
          validatedParams.quoteTypes.length === 0
        ) {
          return true;
        }
        // Filter to include any of the specified quote types
        return validatedParams.quoteTypes.includes(quote.quoteType || "");
      })
      .map((quote: QuoteResult) => ({
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
