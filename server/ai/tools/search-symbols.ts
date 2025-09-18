"use server";

import { searchYahooFinanceSymbols } from "@/server/symbols/search";

interface SearchSymbolsParams {
  query: string;
  limit?: number;
}

export async function searchSymbols(params: SearchSymbolsParams) {
  const { query, limit = 10 } = params;

  const result = await searchYahooFinanceSymbols({
    query,
    limit,
  });

  if (!result.success) {
    throw new Error(result.message || "Failed to search symbols");
  }

  return {
    query,
    total: result.data?.length || 0,
    symbols: result.data || [],
  };
}
