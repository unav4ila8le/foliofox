import { formatDistanceToNow } from "date-fns";
import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { NewsSearchResult } from "@/server/news/fetch";

interface HoldingNewsProps {
  newsData: NewsSearchResult;
}

export function HoldingNews({ newsData }: HoldingNewsProps) {
  // Handle error state
  if (!newsData.success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <Newspaper className="text-muted-foreground size-4" />
        </div>
        <p className="mt-3 font-medium">News</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {newsData.message || "Failed to load news"}
        </p>
      </div>
    );
  }

  // Handle empty state (no symbol_id or no news)
  if (!newsData.data || newsData.data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="bg-accent rounded-lg p-2">
          <Newspaper className="text-muted-foreground size-4" />
        </div>
        <p className="mt-3 font-medium">News</p>
        <p className="text-muted-foreground mt-1 text-sm">
          There is no news for this holding yet.
        </p>
      </div>
    );
  }

  // Display news articles
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">News</h3>
      <div className="custom-scrollbar divide-y overflow-y-auto">
        {newsData.data.map((article) => (
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
            {article.related_symbol_ids &&
              article.related_symbol_ids.length > 0 && (
                <Badge variant="outline" className="group-hover:bg-accent">
                  {article.related_symbol_ids[0]}
                </Badge>
              )}
          </a>
        ))}
      </div>
    </div>
  );
}
