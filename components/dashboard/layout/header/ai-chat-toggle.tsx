"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/custom/sidebar";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { AI_CHAT_ROUTE } from "@/components/dashboard/ai-chat/navigation";

export function AIChatToggle() {
  const pathname = usePathname();
  const { toggleRight, openRight, openMobileRight } = useSidebar();

  if (pathname === AI_CHAT_ROUTE || openRight || openMobileRight) {
    return null;
  }

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={() => toggleRight()}>
          <MessageCircle />
          AI Advisor
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          Open AI Advisor
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>I</Kbd>
          </KbdGroup>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
