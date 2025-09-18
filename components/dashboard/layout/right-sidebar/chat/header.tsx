import { useState } from "react";
import { Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSidebar } from "@/components/ui/sidebar";

interface ChatHeaderProps {
  conversations?: {
    id: string;
    title: string;
    updatedAt: string;
  }[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ChatHeader({
  conversations = [],
  onSelectConversation,
  onNewConversation,
}: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const { rightWidth } = useSidebar();

  return (
    <div className="relative flex items-center justify-between p-2">
      <span className="text-sm font-medium">AI Chat</span>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Clock />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent showArrow={false}>
              Conversation history
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            className="p-0"
            style={{ width: `calc(${rightWidth} - 16px)`, marginRight: "8px" }}
          >
            <Command>
              <CommandInput placeholder="Search conversation..." />
              <CommandList>
                {conversations.length === 0 ? (
                  <CommandEmpty>No conversations found.</CommandEmpty>
                ) : (
                  <CommandGroup heading="Recent">
                    {conversations.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.title}
                        onSelect={() => {
                          onSelectConversation?.(c.id);
                          setOpen(false);
                        }}
                        className="flex items-start justify-between gap-6"
                      >
                        <p className="line-clamp-3">{c.title}</p>
                        <span className="text-muted-foreground flex-none">
                          {formatDistanceToNow(new Date(c.updatedAt))}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onNewConversation}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false}>New conversation</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
