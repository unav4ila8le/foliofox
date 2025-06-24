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
          10:00 PM UTC · European Central Bank
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p>
          Exchange rates and market prices are not updated in real-time.
          <br />
          Data is refreshed daily at 10:00 PM UTC.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
