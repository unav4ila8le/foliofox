import { useState } from "react";
import { History, Plus, LoaderCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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

import { deleteConversation } from "@/server/ai/conversations/delete";

interface ChatHeaderProps {
  conversations?: {
    id: string;
    title: string;
    updatedAt: string;
  }[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onConversationDeleted?: () => void;
  isLoadingConversation?: boolean;
}

export function ChatHeader({
  conversations = [],
  onSelectConversation,
  onNewConversation,
  onConversationDeleted,
  isLoadingConversation,
}: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { rightWidth } = useSidebar();

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Prevent selecting the conversation
    setDeletingId(conversationId);
    try {
      await deleteConversation(conversationId);
      onConversationDeleted?.(); // Refresh the conversation list
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete conversation",
      );
      setDeletingId(null);
    }
  };

  return (
    <div className="relative flex items-center gap-4 p-2 xl:justify-between">
      <span className="text-sm font-medium">AI Chat</span>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <History />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent showArrow={false}>
              Conversation history
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            align="start"
            className="p-0"
            style={{ width: `calc(${rightWidth} - 16px)`, marginRight: "8px" }}
          >
            <Command>
              <CommandInput placeholder="Search conversation..." />
              <CommandList>
                {conversations.length === 0 ? (
                  <CommandEmpty>No conversations found.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {conversations.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.title}
                        disabled={isLoadingConversation || deletingId === c.id}
                        onSelect={() => {
                          onSelectConversation?.(c.id);
                          setOpen(false);
                        }}
                        className="group items-start gap-2"
                      >
                        <div className="flex flex-1 flex-col items-start gap-0">
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(c.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                          <p className="line-clamp-3">{c.title}</p>
                        </div>
                        <div
                          onClick={(e) => handleDelete(e, c.id)}
                          className="group/delete flex-none"
                        >
                          {deletingId === c.id ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="text-muted-foreground group-hover/delete:text-destructive size-3.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
              disabled={isLoadingConversation}
            >
              {isLoadingConversation ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Plus />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false}>New conversation</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
