"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { getSymbolQuote, searchSymbols } from "@/server/symbols/search";

import type { Symbol } from "@/types/global.types";

// Create symbol using Yahoo Finance data
export async function createSymbol(symbolId: string) {
  const { supabase } = await getCurrentUser();

  // Get symbol data from Yahoo Finance
  const quoteResult = await getSymbolQuote(symbolId);

  if (!quoteResult.success) {
    return {
      success: false,
      code: "QUOTE_FETCH_ERROR",
      message: `Failed to fetch quote data for symbol ${symbolId}: ${quoteResult.message}`,
    };
  }

  // Try to get sector/industry from search if missing from quote
  let sector = quoteResult.data?.sector;
  let industry = quoteResult.data?.industry;

  if (!sector || !industry) {
    const searchResult = await searchSymbols({ query: symbolId, limit: 1 });
    if (searchResult.success && searchResult.data?.[0]) {
      const { sector: searchSector, industry: searchIndustry } =
        searchResult.data[0];
      sector = sector || searchSector;
      industry = industry || searchIndustry;
    }
  }

  // Extract and validate data for symbol creation
  const data: Symbol = {
    id: symbolId,
    quote_type: quoteResult.data?.quoteType,
    short_name: quoteResult.data?.shortName,
    long_name: quoteResult.data?.longName,
    exchange: quoteResult.data?.exchange,
    currency: quoteResult.data?.currency,
    sector,
    industry,
  };

  // Insert into symbols table
  const { error } = await supabase.from("symbols").upsert(data);

  // Return Supabase errors instead of throwing
  if (error) {
    return {
      success: false,
      code: error.code || "UNKNOWN",
      message: error.message || "Failed to create symbol",
    };
  }

  return { success: true };
}
