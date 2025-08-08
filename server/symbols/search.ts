"use server";

import YahooFinance from "yahoo-finance2";
import { z } from "zod";

import type { Symbol } from "@/types/global.types";

const yahooFinance = new YahooFinance();

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, { error: "Search query is required." }),
  limit: z.number().min(1).max(20).optional().default(10),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export async function searchSymbols(params: SearchParams) {
  try {
    // Validate the input parameters
    const validatedParams = searchParamsSchema.parse(params);

    // Perform the search using yahoo-finance2
    const searchResults = await yahooFinance.search(validatedParams.query, {
      quotesCount: validatedParams.limit,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    // Filter and transform the results to match Symbol type
    const symbols: Symbol[] = searchResults.quotes
      .filter((quote: Record<string, unknown>) => {
        // Only include quotes that have a valid symbol
        return (
          quote.symbol &&
          typeof quote.symbol === "string" &&
          quote.symbol.trim() !== ""
        );
      })
      .map((quote: Record<string, unknown>) => ({
        id: quote.symbol as string,
        quote_type: quote.quoteType as string,
        short_name: (quote.shortname as string) || null,
        long_name: (quote.longname as string) || null,
        exchange:
          (quote.exchDisp as string) || (quote.exchange as string) || null,
        industry: (quote.industry as string) || null,
        sector: (quote.sector as string) || null,
        currency: (quote.currency as string) || "",
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
    const quoteData = await yahooFinance.quote(symbolId, {
      fields: [
        "symbol",
        "quoteType",
        "shortName",
        "longName",
        "currency",
        "exchange",
        "fullExchangeName",
      ],
    });

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
