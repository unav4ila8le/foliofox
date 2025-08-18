import { Newspaper } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

const news = true;

export function NewsWidget({
  symbol,
  variant = "card",
}: {
  symbol?: string;
  variant?: "card" | "compact";
}) {
  return (
    <Card
      className={cn(
        "flex h-80 flex-col gap-4",
        variant === "compact" &&
          "-mx-6 h-auto border-none bg-transparent p-0 shadow-none",
      )}
    >
      {!news ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <Newspaper className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio News</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add holdings to start receiving news related to your portfolio
          </p>
        </div>
      ) : (
        <>
          <CardHeader className="flex-none">
            <CardTitle>
              {symbol ? `${symbol} News` : "Portfolio News"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 divide-y overflow-y-auto">
            <div className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                AAPL
              </Badge>
            </div>
            <div className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                AAPL
              </Badge>
            </div>
            <div className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                AAPL
              </Badge>
            </div>
            <div className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                AAPL
              </Badge>
            </div>
            <div className="group flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium md:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                AAPL
              </Badge>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
