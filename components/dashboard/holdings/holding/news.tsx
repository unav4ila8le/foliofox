import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const news = true;

export function HoldingNews({ symbol }: { symbol?: string }) {
  return (
    <>
      {!news ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <Newspaper className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">{symbol} News</p>
          <p className="text-muted-foreground mt-1 text-sm">
            There is no news for this holding yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold">{symbol} News</h3>
          <div className="divide-y overflow-y-auto">
            <div className="group flex cursor-pointer items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <h4 className="line-clamp-3 text-sm font-medium lg:line-clamp-2">
                  European Leaders to Join Zelenskiy for Meeting With Trump
                </h4>
                <p className="text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                  Bloomberg • 17h ago
                </p>
              </div>
              <Badge variant="outline" className="group-hover:bg-accent">
                {symbol}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
