"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AnalyticsMetricCardProps {
  title: string;
  summary: React.ReactNode;
  details?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  className?: string;
}

export function AnalyticsMetricCard({
  title,
  summary,
  details,
  trend,
  trendLabel,
  className = "",
}: AnalyticsMetricCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!details;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' :
            'text-muted-foreground'
          }`}>
            {trend === 'up' && <TrendingUp className="h-4 w-4" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4" />}
            {trendLabel && <span>{trendLabel}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-2">{summary}</div>

        {/* Expand/collapse button */}
        {hasDetails && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-2 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  Show Details
                </>
              )}
            </Button>

            {/* Details section */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t">
                {details}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
