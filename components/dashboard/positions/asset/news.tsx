import { formatDistanceToNow } from "date-fns";
import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { NewsSearchResult } from "@/server/news/fetch";

interface AssetNewsProps {
  newsData: NewsSearchResult;
}

export function AssetNews({ newsData }: AssetNewsProps) {
  // Handle error state
  if (!newsData.success) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <Newspaper className="text-muted-foreground size-4" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {newsData.message || "Failed to load news"}
        </p>
      </div>
    );
  }

  // Handle empty state (no symbol_id or no news)
  if (!newsData.data || newsData.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <Newspaper className="text-muted-foreground size-4" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          There is no news for this asset yet
        </p>
      </div>
    );
  }

  // Display news articles
  return (
    <div className="divide-y">
      {newsData.data.map((article) => {
        const primarySymbol =
          article.related_symbols?.find((sym) => sym.ticker) ??
          article.related_symbols?.[0];
        const fallbackId = article.related_symbol_ids?.[0];
        const label = primarySymbol?.ticker ?? fallbackId ?? null;

        return (
          <a
            key={article.id}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex cursor-pointer items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="space-y-1">
              <h4 className="line-clamp-3 text-sm font-medium lg:line-clamp-2">
                {article.title}
              </h4>
              <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                {article.publisher} •{" "}
                {formatDistanceToNow(new Date(article.published_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
            {label && (
              <Badge variant="outline" className="group-hover:bg-accent">
                {label}
              </Badge>
            )}
          </a>
        );
      })}
    </div>
  );
}
