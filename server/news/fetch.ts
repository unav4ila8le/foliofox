"use server";

import YahooFinance from "yahoo-finance2";

import { createServiceClient } from "@/supabase/service";
import { fetchHoldings } from "@/server/holdings/fetch";

import type { NewsArticle } from "@/types/global.types";
import type { TablesInsert } from "@/types/database.types";

export interface NewsSearchResult {
  success: boolean;
  data?: NewsArticle[];
  message?: string;
}

// Initialize yahooFinance consistent with other modules
const yahooFinance = new YahooFinance();

// Cache duration: 15 minutes
const CACHE_DURATION_MS = 15 * 60 * 1000;

/**
 * Fetch news for specific symbols with caching
 * @param symbolIds - Array of symbol IDs to fetch news for
 * @param limit - Maximum number of articles per symbol (default: 5)
 * @returns Aggregated and sorted news articles
 */
export async function fetchNewsForSymbols(
  symbolIds: string[],
  limit: number = 5,
) {
  try {
    // Early return if no symbols provided
    if (!symbolIds.length) {
      return { success: true, data: [] };
    }

    const supabase = createServiceClient();
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);

    // 1. Check cache for ALL symbols at once
    // Use 'overlaps' to find articles that relate to ANY of our symbols
    const { data: cachedNews } = await supabase
      .from("news")
      .select("*")
      .overlaps("related_symbol_ids", symbolIds) // Find news matching ANY symbol
      .gte("created_at", cacheThreshold.toISOString()) // Only fresh cache (< 15 minutes old)
      .order("published_at", { ascending: false });

    // 2. Figure out which symbols have enough cached articles
    const symbolsWithEnoughCache = new Set<string>();
    const allCachedArticles: NewsArticle[] = [];

    if (cachedNews) {
      // Count how many articles we have for each symbol
      const articleCountBySymbol = new Map<string, number>();

      cachedNews.forEach((article) => {
        // Convert database strings to proper Date objects
        const processedArticle = {
          ...article,
        };
        allCachedArticles.push(processedArticle);

        // Count this article for each symbol it relates to
        article.related_symbol_ids?.forEach((symbolId) => {
          if (symbolIds.includes(symbolId)) {
            const currentCount = articleCountBySymbol.get(symbolId) || 0;
            articleCountBySymbol.set(symbolId, currentCount + 1);
          }
        });
      });

      // Mark symbols that have enough cached articles
      symbolIds.forEach((symbolId) => {
        const count = articleCountBySymbol.get(symbolId) || 0;
        if (count >= limit) {
          symbolsWithEnoughCache.add(symbolId);
        }
      });
    }

    // 3. Find symbols that need fresh data from Yahoo Finance
    const symbolsNeedingFresh = symbolIds.filter(
      (symbolId) => !symbolsWithEnoughCache.has(symbolId),
    );

    // 4. Fetch fresh data only for symbols that need it
    const freshArticles: NewsArticle[] = [];
    const articlesToCache: TablesInsert<"news">[] = []; // For batch database insert

    if (symbolsNeedingFresh.length > 0) {
      // Fetch all symbols in parallel from Yahoo Finance
      const fetchPromises = symbolsNeedingFresh.map(async (symbolId) => {
        try {
          const searchResult = await yahooFinance.search(symbolId, {
            quotesCount: 0,
            newsCount: limit,
            enableFuzzyQuery: false,
          });
          return { symbolId, searchResult };
        } catch (error) {
          console.warn(`Failed to fetch news for symbol ${symbolId}:`, error);
          return { symbolId, searchResult: null };
        }
      });

      const results = await Promise.all(fetchPromises);

      // Process all results
      results.forEach(({ symbolId, searchResult }) => {
        if (searchResult?.news && searchResult.news.length > 0) {
          searchResult.news.forEach((article) => {
            articlesToCache.push({
              yahoo_uuid: article.uuid,
              title: article.title,
              publisher: article.publisher,
              link: article.link,
              published_at: article.providerPublishTime.toISOString(),
              related_symbol_ids: [
                ...new Set([symbolId, ...(article.relatedTickers || [])]),
              ],
            });

            freshArticles.push({
              id: crypto.randomUUID(),
              yahoo_uuid: article.uuid,
              title: article.title,
              publisher: article.publisher,
              link: article.link,
              published_at: article.providerPublishTime.toISOString(),
              related_symbol_ids: [
                ...new Set([symbolId, ...(article.relatedTickers || [])]),
              ],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          });
        }
      });

      // 5. Store all new articles in database with one batch operation
      if (articlesToCache.length > 0) {
        // Remove duplicates before upserting
        const uniqueArticles = [];
        const seen = new Set<string>();
        for (const article of articlesToCache) {
          if (!seen.has(article.yahoo_uuid)) {
            seen.add(article.yahoo_uuid);
            uniqueArticles.push(article);
          }
        }

        const { error: insertError } = await supabase
          .from("news")
          .upsert(uniqueArticles, { onConflict: "yahoo_uuid" });

        if (insertError) {
          console.error("Failed to cache news articles:", insertError);
          // Continue anyway - we can still return the fresh news
        }
      }
    }

    // 6. Combine cached and fresh articles
    const allArticles = [...allCachedArticles, ...freshArticles];

    // 7. Remove duplicates based on yahoo_uuid (same article from different symbols)
    const uniqueArticles = allArticles.filter(
      (article, index, array) =>
        array.findIndex((a) => a.yahoo_uuid === article.yahoo_uuid) === index,
    );

    // 8. Sort by publication date (newest first)
    uniqueArticles.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );

    return {
      success: true,
      data: uniqueArticles,
    };
  } catch (error) {
    console.error("Error fetching news for symbols:", symbolIds, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch news",
    };
  }
}

/**
 * Fetch news for user's portfolio symbols
 * @param limit - Maximum total articles to return
 * @returns Portfolio news sorted chronologically
 */
export async function fetchPortfolioNews(limit: number = 10) {
  try {
    const holdings = await fetchHoldings({
      includeArchived: false,
      quoteDate: null,
    });
    const symbolIds = holdings
      .filter((holding) => holding.symbol_id)
      .map((holding) => holding.symbol_id!);

    if (symbolIds.length === 0) {
      return { success: true, data: [] };
    }

    return await fetchNewsForSymbols(
      symbolIds,
      Math.ceil(limit / symbolIds.length),
    );
  } catch (error) {
    console.error("Error fetching portfolio news:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch portfolio news",
    };
  }
}

/**
 * Fetch news for a specific symbol (for individual holding pages)
 * @param symbolId - The symbol to fetch news for
 * @param limit - Maximum articles to return
 * @returns News articles for the symbol
 */
export async function fetchSymbolNews(symbolId: string, limit: number = 5) {
  return await fetchNewsForSymbols([symbolId], limit);
}
