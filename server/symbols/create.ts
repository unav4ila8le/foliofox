"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchYahooFinanceSymbol } from "@/server/symbols/search";
import { fetchCurrencies } from "@/server/currencies/fetch";
import {
  resolveSymbolInput,
  setPrimarySymbolAlias,
} from "@/server/symbols/resolve";
import { fetchQuotes } from "@/server/quotes/fetch";
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

  // 3) Refresh only the canonical symbol behind the active Yahoo alias. A
  // retired alias with the same ticker belongs to historical identity, so a
  // reused ticker creates a fresh UUID instead of overwriting that row.
  const existing = await resolveSymbolInput(symbolData.ticker, {
    source: "yahoo",
    type: "ticker",
    activeOnly: true,
  });
  const { data: savedSymbol, error: saveError } = existing?.symbol.id
    ? await supabase
        .from("symbols")
        .update(symbolData)
        .eq("id", existing.symbol.id)
        .select("*")
        .single()
    : await supabase.from("symbols").insert(symbolData).select("*").single();

  if (saveError || !savedSymbol) {
    return {
      success: false,
      code: saveError?.code || "SYMBOL_UPSERT_FAILED",
      message: saveError?.message || "Failed to create or refresh symbol",
    };
  }

  // 4) Ensure a primary ticker alias exists and points to the latest value
  try {
    await setPrimarySymbolAlias(savedSymbol.id, symbolData.ticker, {
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

  // 5) Warm the quote cache so the symbol has last_quote_at set immediately.
  // Without this, the dashboard staleness check (last_quote_at IS NULL) races
  // the first page-render quote fetch and flags fresh imports as stale.
  // Best-effort: quote availability must not block symbol creation.
  try {
    await fetchQuotes([{ symbolLookup: savedSymbol.id, date: new Date() }], {
      upsert: true,
    });
  } catch (quoteError) {
    console.error(
      `Failed to warm quote cache for new symbol ${symbolData.ticker}:`,
      quoteError,
    );
  }

  return { success: true, data: savedSymbol };
}
