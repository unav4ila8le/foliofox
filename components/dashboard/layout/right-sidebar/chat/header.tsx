import { Clock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function ChatHeader() {
  return (
    <div className="flex items-center justify-between px-2 py-4">
      <span className="text-sm font-medium">AI Chat</span>
      <div className="flex items-center gap-2">
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Clock />
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false}>
            Conversation history
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false}>New conversation</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
