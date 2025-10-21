"use server";

import { fetchPortfolioNews, fetchNewsForSymbols } from "@/server/news/fetch";

interface GetNewsParams {
  symbolIds: string[] | null;
  limit: number | null;
}

export async function getNews(params: GetNewsParams) {
  const symbolIds = params.symbolIds ?? undefined;
  const limit = params.limit ?? 10;

  // If no symbols provided, default to portfolio news
  if (!symbolIds || symbolIds.length === 0) {
    const result = await fetchPortfolioNews(limit);

    if (!result.success) {
      throw new Error(result.message || "Failed to fetch portfolio news");
    }

    return {
      source: "portfolio",
      total: result.data?.length || 0,
      articles: result.data || [],
    };
  }

  // Fetch news for specific symbols
  // fetchNewsForSymbols handles limit distribution automatically
  const result = await fetchNewsForSymbols(symbolIds, limit);

  if (!result.success) {
    throw new Error(result.message || "Failed to fetch news");
  }

  return {
    source: "specific_symbols",
    symbolIds,
    total: result.data?.length || 0,
    articles: result.data || [],
  };
}
