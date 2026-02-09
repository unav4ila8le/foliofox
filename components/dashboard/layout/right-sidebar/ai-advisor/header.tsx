import { useState } from "react";
import { History, Plus, Settings, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { useSidebar } from "@/components/ui/custom/sidebar";
import { AISettingsDialog } from "@/components/features/ai-settings/dialog";

import { deleteConversation } from "@/server/ai/conversations/delete";

interface ChatHeaderProps {
  conversations?: {
    id: string;
    title: string;
    updatedAt: string;
  }[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onConversationDeleted?: () => Promise<void> | void;
  isLoadingConversation?: boolean;
  isAIEnabled?: boolean;
  isAtConversationCap?: boolean;
  maxConversations?: number;
  totalConversations?: number;
}

export function ChatHeader({
  conversations = [],
  onSelectConversation,
  onNewConversation,
  onConversationDeleted,
  isLoadingConversation,
  isAIEnabled,
  isAtConversationCap,
  maxConversations = 0,
  totalConversations = 0,
}: ChatHeaderProps) {
  const [openHistory, setOpenHistory] = useState(false);
  const [openAISettings, setOpenAISettings] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { rightWidth } = useSidebar();
  const isNewConversationDisabled =
    isLoadingConversation || !isAIEnabled || isAtConversationCap;

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Prevent selecting the conversation
    setDeletingId(conversationId);
    try {
      await deleteConversation(conversationId);
      await onConversationDeleted?.(); // Refresh the conversation list
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete conversation",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative flex items-center gap-4 p-2 xl:justify-between">
      <span className="text-sm font-medium">AI Chat</span>
      <div className="flex items-center gap-1">
        {/* Conversation history */}
        <Popover open={openHistory} onOpenChange={setOpenHistory}>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isAIEnabled}
                  aria-label="Conversation history"
                >
                  <History />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Conversation history</TooltipContent>
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
                        // Value must be unique per item for stable cmdk hover/active behavior.
                        value={`${c.title} ${c.id}`}
                        disabled={isLoadingConversation || deletingId === c.id}
                        onSelect={() => {
                          onSelectConversation?.(c.id);
                          setOpenHistory(false);
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
                            <Spinner className="size-3.5" />
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

        {/* AI settings */}
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenAISettings(true)}
              aria-label="AI settings"
            >
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI settings</TooltipContent>
        </Tooltip>

        {/* New conversation */}
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              tabIndex={isNewConversationDisabled ? 0 : undefined}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewConversation}
                aria-label="New conversation"
                // Proactive guard: user must delete an older thread first.
                disabled={isNewConversationDisabled}
              >
                {isLoadingConversation ? <Spinner /> : <Plus />}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isAtConversationCap
              ? `Limit reached (${totalConversations}/${maxConversations})`
              : "New conversation"}
          </TooltipContent>
        </Tooltip>
      </div>
      <AISettingsDialog
        open={openAISettings}
        onOpenChange={setOpenAISettings}
      />
    </div>
  );
}
