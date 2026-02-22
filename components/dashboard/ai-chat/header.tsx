import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import {
  Expand,
  History,
  PanelRightClose,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
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
import { AISettingsDialog } from "@/components/features/ai-settings/dialog";

import { deleteConversation } from "@/server/ai/conversations/delete";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  layoutMode: "sidebar" | "page";
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
  historyPopoverWidth?: string;
  modeActionHref?: string | null;
}

export function ChatHeader({
  layoutMode,
  conversations = [],
  onSelectConversation,
  onNewConversation,
  onConversationDeleted,
  isLoadingConversation,
  isAIEnabled,
  isAtConversationCap,
  maxConversations = 0,
  totalConversations = 0,
  historyPopoverWidth,
  modeActionHref,
}: ChatHeaderProps) {
  const [openHistory, setOpenHistory] = useState(false);
  const [openAISettings, setOpenAISettings] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isNewConversationDisabled =
    isLoadingConversation || !isAIEnabled || isAtConversationCap;

  const popoverStyle = historyPopoverWidth
    ? ({
        width: historyPopoverWidth,
        marginRight: "8px",
      } as CSSProperties)
    : undefined;

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
    <div
      className={cn(
        "relative flex items-center gap-4 px-4 py-2",
        layoutMode === "page" ? "justify-between" : "xl:justify-between",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          layoutMode === "page" ? "font-semibold" : "text-sm font-medium",
        )}
      >
        AI Chat
        {modeActionHref ? (
          <Button
            size="xs"
            variant="outline"
            asChild
            className="hidden cursor-default xl:inline-flex"
          >
            <Link href={modeActionHref}>
              {layoutMode === "page" ? (
                <>
                  <PanelRightClose /> Move to sidebar
                </>
              ) : (
                <>
                  <Expand /> Expand
                </>
              )}
            </Link>
          </Button>
        ) : null}
      </div>
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
            className="w-[min(32rem,calc(100vw-2rem))] p-0"
            style={popoverStyle}
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
