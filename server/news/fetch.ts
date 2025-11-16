"use server";

import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import { fetchPositions } from "@/server/positions/fetch";
import {
  resolveSymbolInput,
  resolveSymbolsBatch,
} from "@/server/symbols/resolver";

import type { NewsArticle } from "@/types/global.types";
import type { TablesInsert } from "@/types/database.types";

export interface NewsSearchResult {
  success: boolean;
  data?: EnrichedNewsArticle[];
  message?: string;
}

type EnrichedNewsArticle = NewsArticle & {
  related_symbols: Array<{ id: string; ticker: string | null }>;
};

// Cache duration: 30 minutes
const CACHE_DURATION_MS = 30 * 60 * 1000;

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

    // 1) Batch resolve all symbol identifiers to canonical UUIDs and Yahoo tickers
    const uniqueInputs = [
      ...new Set(
        symbolIds.map((id) => id.trim()).filter((id) => id.length > 0),
      ),
    ];

    const { byInput, byCanonicalId } = await resolveSymbolsBatch(uniqueInputs, {
      provider: "yahoo",
      providerType: "ticker",
      onError: "warn",
    });

    const canonicalIds = [...byCanonicalId.keys()];
    if (!canonicalIds.length) {
      return { success: true, data: [] };
    }
    const canonicalIdSet = new Set(canonicalIds);

    // Start with batch-resolved metadata, then extend as we discover related symbols
    const canonicalMeta = new Map(byCanonicalId);

    const supabase = createServiceClient();
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);

    // 2) Check the cache for ALL requested canonical symbols at once
    const { data: cachedNews } = await supabase
      .from("news")
      .select("*")
      .overlaps("related_symbol_ids", canonicalIds)
      .gte("updated_at", cacheThreshold.toISOString())
      .order("published_at", { ascending: false });

    const canonicalWithEnoughCache = new Set<string>();
    const allCachedArticles: NewsArticle[] = [];

    if (cachedNews) {
      const articleCountByCanonical = new Map<string, number>();

      cachedNews.forEach((article: NewsArticle) => {
        allCachedArticles.push({ ...article });
        article.related_symbol_ids?.forEach((symbolId: string) => {
          if (!canonicalIdSet.has(symbolId)) return;
          const current = articleCountByCanonical.get(symbolId) || 0;
          articleCountByCanonical.set(symbolId, current + 1);
        });
      });

      canonicalIds.forEach((canonicalId) => {
        const count = articleCountByCanonical.get(canonicalId) || 0;
        if (count >= limit) {
          canonicalWithEnoughCache.add(canonicalId);
        }
      });
    }

    // 3) Determine which canonical symbols still need fresh data
    const canonicalNeedingFresh = canonicalIds.filter(
      (canonicalId) => !canonicalWithEnoughCache.has(canonicalId),
    );

    // 4) Fetch fresh data only for canonical symbols that need it
    const freshArticles: NewsArticle[] = [];
    const articlesToCache: TablesInsert<"news">[] = []; // For batch database insert
    const relatedResolutionCache = new Map<
      string,
      { canonicalId: string | null; displayTicker: string | null }
    >();

    if (canonicalNeedingFresh.length > 0) {
      const fetchPromises = canonicalNeedingFresh.map(async (canonicalId) => {
        const tickerInfo = canonicalMeta.get(canonicalId);
        const yahooTicker = tickerInfo?.providerAlias;
        if (!yahooTicker) {
          console.warn(
            `Skipping news fetch for canonical symbol ${canonicalId}: missing Yahoo ticker alias.`,
          );
          return { canonicalId, searchResult: null };
        }

        try {
          const searchResult = await yahooFinance.search(yahooTicker, {
            quotesCount: 0,
            newsCount: limit,
            enableFuzzyQuery: false,
          });
          return { canonicalId, searchResult };
        } catch (error) {
          console.warn(
            `Failed to fetch news for canonical symbol ${canonicalId} (${yahooTicker}):`,
            error,
          );
          return { canonicalId, searchResult: null };
        }
      });

      const results = await Promise.all(fetchPromises);

      // Process all results
      for (const { canonicalId, searchResult } of results) {
        if (!searchResult?.news?.length) {
          continue;
        }
        for (const article of searchResult.news) {
          const canonicalRelatedIds = new Set<string>([canonicalId]);

          for (const relatedTicker of article.relatedTickers || []) {
            const trimmed = relatedTicker.trim();
            if (!trimmed) continue;

            const existingResolution = byInput.get(trimmed);
            if (existingResolution) {
              canonicalRelatedIds.add(existingResolution.canonicalId);
              if (!canonicalMeta.has(existingResolution.canonicalId)) {
                canonicalMeta.set(existingResolution.canonicalId, {
                  providerAlias: existingResolution.providerAlias,
                  displayTicker: existingResolution.displayTicker,
                });
              }
              continue;
            }

            if (relatedResolutionCache.has(trimmed)) {
              const cached = relatedResolutionCache.get(trimmed);
              if (cached?.canonicalId) {
                canonicalRelatedIds.add(cached.canonicalId);
                if (
                  cached.displayTicker &&
                  !canonicalMeta.has(cached.canonicalId)
                ) {
                  canonicalMeta.set(cached.canonicalId, {
                    providerAlias: cached.displayTicker,
                    displayTicker: cached.displayTicker,
                  });
                }
              }
              continue;
            }

            const relatedResolved = await resolveSymbolInput(trimmed);
            const relatedCanonical = relatedResolved?.symbol?.id ?? null;
            const relatedDisplayTicker =
              relatedResolved?.primaryAlias?.value ??
              relatedResolved?.symbol?.ticker ??
              null;
            relatedResolutionCache.set(trimmed, {
              canonicalId: relatedCanonical,
              displayTicker: relatedDisplayTicker,
            });
            if (relatedCanonical) {
              canonicalRelatedIds.add(relatedCanonical);
              if (!canonicalMeta.has(relatedCanonical)) {
                canonicalMeta.set(relatedCanonical, {
                  providerAlias: relatedDisplayTicker ?? trimmed,
                  displayTicker: relatedDisplayTicker,
                });
              }
            }
          }

          const relatedIdsArray = Array.from(canonicalRelatedIds);

          articlesToCache.push({
            yahoo_uuid: article.uuid,
            title: article.title,
            publisher: article.publisher,
            link: article.link,
            published_at: article.providerPublishTime.toISOString(),
            related_symbol_ids: relatedIdsArray,
          });

          freshArticles.push({
            id: crypto.randomUUID(),
            yahoo_uuid: article.uuid,
            title: article.title,
            publisher: article.publisher,
            link: article.link,
            published_at: article.providerPublishTime.toISOString(),
            related_symbol_ids: relatedIdsArray,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // 5. Store all new articles in database with one batch operation
      if (articlesToCache.length > 0) {
        // Group articles by yahoo_uuid to handle duplicates
        const articlesByUuid = new Map<string, typeof articlesToCache>();
        for (const article of articlesToCache) {
          const existing = articlesByUuid.get(article.yahoo_uuid);
          if (existing) {
            existing.push(article);
          } else {
            articlesByUuid.set(article.yahoo_uuid, [article]);
          }
        }

        // Query existing articles to merge related_symbol_ids
        const uuidsToCheck = Array.from(articlesByUuid.keys());
        const { data: existingArticles } = await supabase
          .from("news")
          .select("yahoo_uuid, related_symbol_ids")
          .in("yahoo_uuid", uuidsToCheck);

        const existingByUuid = new Map(
          existingArticles?.map((a) => [
            a.yahoo_uuid,
            a.related_symbol_ids || [],
          ]) || [],
        );

        // Merge related_symbol_ids for duplicates and existing articles
        const uniqueArticles = [];
        for (const [uuid, articles] of articlesByUuid.entries()) {
          // Collect all related_symbol_ids from all instances of this article
          const allRelatedIds = new Set<string>();
          articles.forEach((article) => {
            article.related_symbol_ids?.forEach((id) => allRelatedIds.add(id));
          });

          // Merge with existing article's related_symbol_ids if it exists
          const existingIds = existingByUuid.get(uuid) || [];
          existingIds.forEach((id) => allRelatedIds.add(id));

          // Use the first article as the base, but with merged related_symbol_ids
          const mergedArticle = {
            ...articles[0],
            related_symbol_ids: Array.from(allRelatedIds),
          };

          uniqueArticles.push(mergedArticle);
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

    // 5) Combine cached and fresh articles
    const allArticles = [...allCachedArticles, ...freshArticles];

    // 6) Remove duplicates based on yahoo_uuid (same article from different symbols)
    const uniqueArticles = allArticles.filter(
      (article, index, array) =>
        array.findIndex((a) => a.yahoo_uuid === article.yahoo_uuid) === index,
    );

    // 7) Sort by publication date (newest first)
    uniqueArticles.sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );

    const canonicalIdToTicker = new Map<string, string>();
    canonicalMeta.forEach(
      (
        meta: { providerAlias: string; displayTicker: string | null },
        canonicalId: string,
      ) => {
        const ticker = meta.displayTicker ?? meta.providerAlias;
        if (ticker) {
          canonicalIdToTicker.set(canonicalId, ticker);
        }
      },
    );

    const enrichedArticles = uniqueArticles.map((article) => ({
      ...article,
      related_symbols:
        article.related_symbol_ids?.map((id) => ({
          id,
          ticker: canonicalIdToTicker.get(id) ?? null,
        })) ?? [],
    }));

    return {
      success: true,
      data: enrichedArticles,
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
    const positions = await fetchPositions({ positionType: "asset" });
    const symbolIds = positions
      .filter((p) => p.symbol_id)
      .map((p) => p.symbol_id!);

    if (symbolIds.length === 0) {
      return { success: true, data: [] };
    }

    const result = await fetchNewsForSymbols(
      symbolIds,
      Math.ceil(limit / symbolIds.length),
    );

    // Apply final limit here:
    if (result.success && result.data) {
      result.data = result.data.slice(0, limit);
    }

    return result;
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
 * Fetch news for a specific symbol (for individual position pages)
 * @param symbolId - The symbol to fetch news for
 * @param limit - Maximum articles to return
 * @returns News articles for the symbol
 */
export async function fetchSymbolNews(symbolId: string, limit: number = 5) {
  return await fetchNewsForSymbols([symbolId], limit);
}
