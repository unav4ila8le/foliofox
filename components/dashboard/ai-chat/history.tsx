"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, Trash2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ChatHistoryProps {
  isAIEnabled?: boolean;
  conversations: {
    id: string;
    title: string;
    updatedAt: string;
  }[];
  onSelectConversation: (id: string) => void;
  isLoadingConversation?: boolean;
  deletingId?: string | null;
  handleDelete: (
    event: MouseEvent<HTMLDivElement>,
    conversationId: string,
  ) => Promise<void> | void;
}

export function ChatHistory({
  isAIEnabled,
  conversations,
  onSelectConversation,
  isLoadingConversation,
  deletingId,
  handleDelete,
}: ChatHistoryProps) {
  const [openHistory, setOpenHistory] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={!isAIEnabled}
        onClick={() => setOpenHistory(true)}
        aria-expanded={openHistory}
        aria-haspopup="dialog"
        aria-label="Conversation history"
      >
        <History />
      </Button>
      <CommandDialog
        open={openHistory}
        onOpenChange={setOpenHistory}
        title="Conversation History"
        description="Search and open previous AI chat conversations."
      >
        <CommandInput placeholder="Search conversation..." />
        <CommandList>
          <CommandEmpty>No conversations found.</CommandEmpty>
          <CommandGroup>
            {conversations.map((conversation) => (
              <CommandItem
                key={conversation.id}
                // Value must be unique per item for stable cmdk hover/active behavior.
                value={`${conversation.title} ${conversation.id}`}
                disabled={
                  isLoadingConversation || deletingId === conversation.id
                }
                onSelect={() => {
                  onSelectConversation(conversation.id);
                  setOpenHistory(false);
                }}
                className="group items-start gap-2"
              >
                <div className="flex flex-1 flex-col items-start gap-0">
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(conversation.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <p className="line-clamp-2">{conversation.title}</p>
                </div>
                <div
                  role="button"
                  onClick={(e) => handleDelete(e, conversation.id)}
                  className="group/delete flex-none"
                  aria-label={`Delete ${conversation.title}`}
                  tabIndex={0}
                >
                  {deletingId === conversation.id ? (
                    <Spinner />
                  ) : (
                    <Trash2 className="text-muted-foreground group-hover/delete:text-destructive opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
