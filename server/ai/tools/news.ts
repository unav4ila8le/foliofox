"use server";

import { fetchPortfolioNews, fetchNewsForSymbols } from "@/server/news/fetch";
import { ensureSymbol } from "@/server/symbols/ensure";

interface GetNewsParams {
  symbolLookups: string[] | null;
  limit: number | null;
}

export async function getNews(params: GetNewsParams) {
  const symbolLookups = params.symbolLookups ?? undefined;
  const limit = params.limit ?? 10;

  // If no symbols provided, default to portfolio news
  if (!symbolLookups || symbolLookups.length === 0) {
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

  // Resolve lookups to canonical symbol IDs (fallback to trimmed lookups when necessary)
  const trimmedLookups = symbolLookups
    .map((lookup) => lookup.trim())
    .filter((lookup) => lookup.length > 0);

  if (!trimmedLookups.length) {
    throw new Error("No valid symbol lookup values provided.");
  }

  const resolvedPairs = await Promise.all(
    trimmedLookups.map(async (lookup) => {
      const ensuredSymbol = await ensureSymbol(lookup);
      const canonicalId = ensuredSymbol?.symbol?.id ?? null;
      return { lookup, canonicalId };
    }),
  );

  const canonicalIds = resolvedPairs
    .map((pair) => pair.canonicalId)
    .filter((id): id is string => Boolean(id));

  if (!canonicalIds.length) {
    throw new Error(
      "Unable to resolve any of the requested symbols. Try using searchSymbols first.",
    );
  }

  const result = await fetchNewsForSymbols(canonicalIds, limit);

  if (!result.success) {
    throw new Error(result.message || "Failed to fetch news");
  }

  return {
    source: "specific_symbols",
    symbolLookups: trimmedLookups,
    resolvedSymbolIds: canonicalIds,
    total: result.data?.length || 0,
    articles: result.data || [],
  };
}
