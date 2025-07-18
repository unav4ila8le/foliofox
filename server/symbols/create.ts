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

  // Always get sector/industry from search since quotes don't provide them
  const searchResult = await searchSymbols({ query: symbolId, limit: 1 });
  const sector =
    (searchResult.success && searchResult.data?.[0]?.sector) || null;
  const industry =
    (searchResult.success && searchResult.data?.[0]?.industry) || null;

  // Extract and validate data for symbol creation
  const quoteData = quoteResult.data;
  if (!quoteData?.quoteType || !quoteData?.exchange || !quoteData?.currency) {
    return {
      success: false,
      code: "QUOTE_DATA_INCOMPLETE",
      message: "Missing required quote data for symbol creation.",
    };
  }
  const data: Symbol = {
    id: symbolId,
    quote_type: quoteData.quoteType,
    short_name: quoteData.shortName || symbolId,
    long_name: quoteData.longName || quoteData.shortName || symbolId,
    exchange: quoteData.exchange,
    currency: quoteData.currency,
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

  return { success: true, data: data };
}
