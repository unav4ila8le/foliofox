"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { getSymbolQuote, searchSymbols } from "@/server/symbols/search";
import { fetchCurrencies } from "@/server/currencies/fetch";

import type { Symbol } from "@/types/global.types";

// Create symbol using Yahoo Finance data
export async function createSymbol(symbolId: string) {
  const { supabase } = await getCurrentUser();

  // 1) Get symbol data from Yahoo Finance
  const quoteResult = await getSymbolQuote(symbolId);

  if (!quoteResult.success) {
    return {
      success: false,
      code: "QUOTE_FETCH_ERROR",
      message: `Failed to fetch quote data for symbol ${symbolId}: ${quoteResult.message}`,
    };
  }

  const quoteData = quoteResult.data;
  if (!quoteData?.quoteType || !quoteData?.exchange || !quoteData?.currency) {
    return {
      success: false,
      code: "QUOTE_DATA_INCOMPLETE",
      message: "Missing required quote data for symbol creation.",
    };
  }

  // 2) Server-side guard: ensure currency is supported in our DB
  const currencyCode = String(quoteData.currency).toUpperCase();
  const currencies = await fetchCurrencies();
  const isSupportedCurrency = currencies.some(
    (c) => c.alphabetic_code === currencyCode,
  );
  if (!isSupportedCurrency) {
    return {
      success: false,
      code: "UNSUPPORTED_CURRENCY",
      message: `Currency ${currencyCode} is not supported yet. Please contact us to add this currency or select a different symbol.`,
    };
  }

  // 3) Fetch sector/industry from search (after currency is validated)
  const searchResult = await searchSymbols({ query: symbolId, limit: 1 });
  const sector =
    (searchResult.success && searchResult.data?.[0]?.sector) || null;
  const industry =
    (searchResult.success && searchResult.data?.[0]?.industry) || null;

  // 4) Prepare data
  const data: Symbol = {
    id: symbolId,
    quote_type: quoteData.quoteType,
    short_name: quoteData.shortName || symbolId,
    long_name: quoteData.longName || quoteData.shortName || symbolId,
    exchange: quoteData.exchange,
    currency: currencyCode,
    sector,
    industry,
  };

  // 5) Insert into symbols table
  const { error } = await supabase.from("symbols").upsert(data);

  if (error) {
    return {
      success: false,
      code: error.code || "UNKNOWN",
      message: error.message || "Failed to create symbol",
    };
  }

  return { success: true, data };
}
