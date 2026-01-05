"use client";

import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";

import { cn } from "@/lib/utils";

interface StaleBadgeProps {
  /** Position ID to check for staleness */
  positionId: string;
  label?: string;
}

export function StaleBadge({ positionId, label }: StaleBadgeProps) {
  const { stalePositions } = useDashboardData();

  const stalePosition = useMemo(
    () => stalePositions.find((sp) => sp.positionId === positionId),
    [stalePositions, positionId],
  );

  if (!stalePosition) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-center gap-1 rounded-full bg-yellow-500/20 text-xs text-yellow-500",
            label ? "px-2 py-0.5" : "p-1.5",
          )}
        >
          <TriangleAlert className="size-3.5" aria-label="Stale market data" />
          {label && <span>{label}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {stalePosition.ticker} market data may be stale. May need attention.
      </TooltipContent>
    </Tooltip>
  );
}
