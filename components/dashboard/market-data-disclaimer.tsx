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
          Market prices and exchange rates are updated daily at 10:00 PM UTC.
          <br />
          Data shown is from the previous trading day.
        </TooltipContent>
      </Tooltip>
      <p className="text-xs">10:00 PM UTC · One day behind</p>
    </div>
  );
}
