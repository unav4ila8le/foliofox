import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MarketDataDisclaimer() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Market prices and exchange rates use the latest available close.
          <br />
          Data is typically one trading day behind and refreshes daily around
          10:00 PM UTC.
        </TooltipContent>
      </Tooltip>
      <p className="text-xs">Latest close · Typically one day behind</p>
    </div>
  );
}
