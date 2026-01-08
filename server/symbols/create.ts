"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchYahooFinanceSymbol } from "@/server/symbols/search";
import { fetchCurrencies } from "@/server/currencies/fetch";
import { setPrimarySymbolAlias } from "@/server/symbols/resolver";
import { createServiceClient } from "@/supabase/service";

// Create symbol using Yahoo Finance data
export async function createSymbol(symbolTicker: string) {
  await getCurrentUser();
  const supabase = createServiceClient();

  // 1) Get symbol data from Yahoo Finance
  const yahooFinanceSymbol = await fetchYahooFinanceSymbol(symbolTicker);

  if (!yahooFinanceSymbol.success) {
    return {
      success: false,
      code: "YAHOO_FINANCE_SYMBOL_FETCH_ERROR",
      message: `Failed to fetch symbol data from Yahoo Finance for symbol ${symbolTicker}: ${yahooFinanceSymbol.message}`,
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

  // 3) Insert/update symbol metadata and fetch canonical row
  const { data: upsertedSymbol, error: upsertError } = await supabase
    .from("symbols")
    .upsert(symbolData, { onConflict: "ticker" })
    .select("*")
    .single();

  if (upsertError || !upsertedSymbol) {
    return {
      success: false,
      code: upsertError?.code || "SYMBOL_UPSERT_FAILED",
      message: upsertError?.message || "Failed to create symbol",
    };
  }

  // 4) Ensure a primary ticker alias exists and points to the latest value
  try {
    await setPrimarySymbolAlias(upsertedSymbol.id, symbolData.ticker, {
      source: "yahoo",
      type: "ticker",
    });
  } catch (aliasError) {
    return {
      success: false,
      code: "SYMBOL_ALIAS_SYNC_FAILED",
      message:
        aliasError instanceof Error
          ? aliasError.message
          : "Failed to sync symbol alias",
    };
  }

  return { success: true, data: upsertedSymbol };
}
