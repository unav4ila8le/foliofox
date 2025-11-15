import { formatDistanceToNow } from "date-fns";
import { Newspaper } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { NewsSearchResult } from "@/server/news/fetch";

interface NewsWidgetProps {
  newsData: NewsSearchResult;
}

export function NewsWidget({ newsData }: NewsWidgetProps) {
  // Handle error state
  if (!newsData.success) {
    return (
      <Card className="flex h-80 flex-col gap-4 rounded-lg shadow-xs">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <Newspaper className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio News</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {newsData.message || "Failed to load news. Please try again later."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle empty state
  if (!newsData.data || newsData.data.length === 0) {
    return (
      <Card className="flex h-80 flex-col gap-4 rounded-lg shadow-xs">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <Newspaper className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio News</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add assets to start receiving news related to your portfolio
          </p>
        </CardContent>
      </Card>
    );
  }

  // Display news articles
  return (
    <Card className="relative flex h-80 flex-col gap-4 overflow-hidden rounded-lg pb-0 shadow-xs">
      <CardHeader className="flex-none">
        <CardTitle>Portfolio News</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 divide-y overflow-y-auto pb-6">
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
              className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
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
      </CardContent>
      <div className="from-card absolute right-6 bottom-0 left-0 h-8 bg-linear-to-t" />
    </Card>
  );
}
