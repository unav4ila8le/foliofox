"use client";

import { format } from "date-fns";
import type { RankedEvent } from "@/lib/projection-analytics";
import { formatCurrency } from "@/lib/number-format";

interface AnalyticsEventListProps {
  events: RankedEvent[];
  currency?: string;
  title?: string;
  emptyMessage?: string;
}

export function AnalyticsEventList({
  events,
  currency = "USD",
  title,
  emptyMessage = "No events found",
}: AnalyticsEventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-semibold mb-3">{title}</h4>}

      {events.map((rankedEvent, index) => {
        const isPositive = rankedEvent.impact > 0;
        const isRecurring = rankedEvent.type === 'recurring';

        return (
          <div
            key={`${rankedEvent.type}-${rankedEvent.event.id}-${index}`}
            className="flex items-start justify-between gap-3 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            {/* Left side: Event info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {rankedEvent.event.emoji && (
                  <span className="text-lg">{rankedEvent.event.emoji}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {rankedEvent.event.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {format(rankedEvent.date, "MMM d, yyyy")}
                    </span>
                    {isRecurring && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Recurring
                      </span>
                    )}
                    {rankedEvent.eventType && (
                      <span className="text-xs bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded capitalize">
                        {rankedEvent.eventType.replace('-', ' ')}
                      </span>
                    )}
                  </div>
                  {rankedEvent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rankedEvent.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs text-muted-foreground bg-background px-1 py-0.5 rounded border"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Impact */}
            <div className="text-right">
              <p
                className={`text-sm font-semibold whitespace-nowrap ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '+' : ''}
                {formatCurrency(rankedEvent.impact, currency)}
              </p>
              {isRecurring && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total impact
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
