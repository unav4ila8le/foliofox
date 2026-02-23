"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { Expand, PanelRightClose, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { AISettingsDialog } from "@/components/dashboard/ai-chat/settings/dialog";
import { ChatHistory } from "@/components/dashboard/ai-chat/history";

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
  modeActionHref,
}: ChatHeaderProps) {
  const [openAISettings, setOpenAISettings] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isNewConversationDisabled =
    isLoadingConversation || !isAIEnabled || isAtConversationCap;

  const handleDelete = async (
    e: MouseEvent<HTMLDivElement>,
    conversationId: string,
  ) => {
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
      <div className="flex items-center gap-2" aria-label="AI chat heading">
        <h2
          className={cn(
            "leading-none",
            layoutMode === "page"
              ? "text-base font-semibold"
              : "text-sm font-medium",
          )}
        >
          AI Chat
        </h2>
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
        <ChatHistory
          isAIEnabled={isAIEnabled}
          conversations={conversations}
          onSelectConversation={onSelectConversation}
          isLoadingConversation={isLoadingConversation}
          deletingId={deletingId}
          handleDelete={handleDelete}
        />

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
