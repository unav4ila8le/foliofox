"use client";

import { Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNetWorthMode } from "@/components/dashboard/net-worth-mode-provider";

export function NetWorthModeToggle() {
  const { isAfterCapitalGains, isRefreshing, setNetWorthModeAction } =
    useNetWorthMode();

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <div className="bg-background flex items-center gap-2 rounded-md border px-2 py-1">
          <Label
            htmlFor="net-worth-mode-toggle"
            className="text-xs font-medium"
          >
            After Tax
          </Label>
          {isRefreshing ? <Loader2 className="size-3 animate-spin" /> : null}
          <Switch
            id="net-worth-mode-toggle"
            checked={isAfterCapitalGains}
            onCheckedChange={(isChecked) =>
              setNetWorthModeAction(isChecked ? "after_capital_gains" : "gross")
            }
            disabled={isRefreshing}
            aria-label="Toggle after-tax valuation mode"
            size="sm"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Include estimated Capital Gains Taxes.
        <br />
        Affects net worth chart values only.
      </TooltipContent>
    </Tooltip>
  );
}
