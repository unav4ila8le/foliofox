"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchYahooFinanceSymbol } from "@/server/symbols/search";
import { fetchCurrencies } from "@/server/currencies/fetch";

// Create symbol using Yahoo Finance data
export async function createSymbol(symbolId: string) {
  const { supabase } = await getCurrentUser();

  // 1) Get symbol data from Yahoo Finance
  const yahooFinanceSymbol = await fetchYahooFinanceSymbol(symbolId);

  if (!yahooFinanceSymbol.success) {
    return {
      success: false,
      code: "YAHOO_FINANCE_SYMBOL_FETCH_ERROR",
      message: `Failed to fetch symbol data from Yahoo Finance for symbol ${symbolId}: ${yahooFinanceSymbol.message}`,
    };
  }

  const symbolData = yahooFinanceSymbol.data;
  if (!symbolData?.quote_type || !symbolData?.currency) {
    return {
      success: false,
      code: "YAHOO_FINANCE_SYMBOL_DATA_INCOMPLETE",
      message:
        "Missing required symbol data from Yahoo Finance for symbol creation.",
    };
  }

  // 2) Server-side guard: ensure currency is supported in our DB
  const currencies = await fetchCurrencies();
  const isSupportedCurrency = currencies.some(
    (c) => c.alphabetic_code === symbolData.currency,
  );
  if (!isSupportedCurrency) {
    return {
      success: false,
      code: "UNSUPPORTED_CURRENCY",
      message: `Currency ${symbolData.currency} is not supported yet. Please contact us to add this currency or select a different symbol.`,
    };
  }

  // 3) Insert into symbols table
  const { error } = await supabase.from("symbols").upsert(symbolData);

  if (error) {
    return {
      success: false,
      code: error.code || "UNKNOWN",
      message: error.message || "Failed to create symbol",
    };
  }

  return { success: true, data: symbolData };
}
