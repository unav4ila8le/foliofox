"use server";

import YahooFinance from "yahoo-finance2";
import { z } from "zod";

import type { SymbolInsert, SymbolSearchResult } from "@/types/global.types";

const yahooFinance = new YahooFinance();

// Define the search parameters schema
const searchParamsSchema = z.object({
  query: z.string().min(1, { error: "Search query is required." }),
  limit: z.number().min(1).max(20).optional().default(10),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export async function searchYahooFinanceSymbols(params: SearchParams) {
  try {
    // Validate the input parameters
    const validatedParams = searchParamsSchema.parse(params);

    // Perform the search using yahoo-finance2
    const searchResults = await yahooFinance.search(validatedParams.query, {
      quotesCount: validatedParams.limit,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    // Filter and transform the results to match SymbolSearchResult type
    const symbols: SymbolSearchResult[] = searchResults.quotes
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
        nameDisp:
          (quote.longname as string) ||
          (quote.shortname as string) ||
          (quote.symbol as string),
        exchange:
          (quote.exchange as string) || (quote.exchDisp as string) || null,
        typeDisp: quote.typeDisp as string,
      }));

    return { success: true, data: symbols };
  } catch (error) {
    console.error("Error searching symbols:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to search symbols",
    };
  }
}

// Fetch quote summary data for a specific symbol
export async function fetchYahooFinanceSymbol(symbolId: string) {
  try {
    const summary = await yahooFinance.quoteSummary(symbolId, {
      modules: ["price", "assetProfile"],
    });

    const price = summary.price;
    const profile = summary.assetProfile;

    const normalizedTicker = symbolId.trim().toUpperCase();
    const data: SymbolInsert = {
      ticker: normalizedTicker,
      quote_type: price?.quoteType || "",
      short_name: price?.shortName || symbolId,
      long_name: price?.longName || price?.shortName || symbolId,
      currency: price?.currency || "",
      exchange: price?.exchangeName || price?.exchange || null,
      sector: profile?.sector || null,
      industry: profile?.industry || null,
    };
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching quote for symbol:", symbolId, error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch quote data",
    };
  }
}
