import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MarketDataDisclaimer() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="text-muted-foreground text-xs lg:text-right">
          10:00 PM UTC · One day behind
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p>
          Market prices and exchange rates are updated daily at 10:00 PM UTC.
          <br />
          Data shown is from the previous trading day.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
