"use client";

import { PanelRight } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { useRightPanel } from "@/components/dashboard/layout/right-panel";

export function RightPanelToggleButton() {
  const { toggle } = useRightPanel();

  return (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={toggle}>
            <PanelRight />
            <span className="sr-only">Toggle AI chat</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle AI chat</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
