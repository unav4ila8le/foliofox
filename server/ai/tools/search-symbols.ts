"use server";

import { searchYahooFinanceSymbols } from "@/server/symbols/search";

interface SearchSymbolsParams {
  query: string;
  limit: number | null;
}

export async function searchSymbols(params: SearchSymbolsParams) {
  const limit = params.limit ?? 10;

  const result = await searchYahooFinanceSymbols({
    query: params.query,
    limit,
  });

  if (!result.success) {
    throw new Error(result.message || "Failed to search symbols");
  }

  return {
    query: params.query,
    total: result.data?.length || 0,
    symbols: result.data || [],
  };
}
