"use client";

import { usePathname } from "next/navigation";

import { AI_CHAT_ROUTE } from "@/components/dashboard/ai-chat/navigation";
import { SidebarTrigger } from "@/components/ui/custom/sidebar";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AIChatToggle() {
  const pathname = usePathname();

  if (pathname === AI_CHAT_ROUTE) {
    return null;
  }

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <SidebarTrigger side="right" className="-mr-2" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          Toggle AI Chat
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>I</Kbd>
          </KbdGroup>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
