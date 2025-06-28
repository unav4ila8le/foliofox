"use server";

import yahooFinance from "yahoo-finance2";
import { z } from "zod";

import type { Symbol } from "@/types/global.types";

// Extract the search result type
type SearchResult = Awaited<ReturnType<typeof yahooFinance.search>>;
type QuoteResult = Awaited<ReturnType<typeof yahooFinance.quote>>;

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().min(1).max(20).optional().default(10),
  quoteTypes: z.array(z.string()).optional(),
});

type SearchParams = z.infer<typeof searchParamsSchema>;
type SearchQuoteResult = SearchResult["quotes"][0];

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
      .filter((quote: SearchQuoteResult) => {
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
      .map((quote: SearchQuoteResult) => ({
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

// Get quote data for a specific symbol
export async function getSymbolQuote(symbolId: string) {
  try {
    const quoteData: QuoteResult = await yahooFinance.quote(
      symbolId,
      {
        fields: [
          "symbol",
          "quoteType",
          "shortName",
          "longName",
          "currency",
          "fullExchangeName",
          "regularMarketPrice",
        ],
      },
      { validateResult: false },
    );

    return {
      success: true,
      data: {
        symbol: symbolId,
        quoteType: quoteData.quoteType,
        shortName: quoteData.shortName || symbolId,
        longName: quoteData.longName || quoteData.shortName || symbolId,
        currency: quoteData.currency,
        exchange: quoteData.fullExchangeName || quoteData.exchange,
        sector: quoteData.sector,
        industry: quoteData.industry,
        regularMarketPrice: quoteData.regularMarketPrice,
      },
    };
  } catch (error) {
    console.error("Error fetching quote for symbol:", symbolId, error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch quote data",
    };
  }
}
