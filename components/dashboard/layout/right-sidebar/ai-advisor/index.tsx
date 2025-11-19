"use client";

import { useState, useEffect } from "react";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { ChatHeader } from "./header";
import { Chat } from "./chat";

import { fetchConversationMessages } from "@/server/ai/messages/fetch";
import { fetchConversations } from "@/server/ai/conversations/fetch";

import { cn } from "@/lib/utils";

import type { UIMessage } from "ai";

export function AIAdvisor() {
  // AI enabled
  const { profile } = useDashboardData();
  const isAIEnabled = profile.data_sharing_consent;

  // Current conversation identifier (used to scope/useChat state)
  const [conversationId, setConversationId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [conversations, setConversations] = useState<
    {
      id: string;
      title: string;
      updatedAt: string;
    }[]
  >([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [copiedMessages, setCopiedMessages] = useState<Set<string>>(new Set());

  // Load conversation list on mount
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const list = await fetchConversations();
        if (!isCancelled) setConversations(list);
      } catch {
        // Ignore load errors; header will show empty state
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Switch to an existing conversation (loads history)
  const handleSelectConversation = async (id: string) => {
    setIsLoadingConversation(true);
    try {
      const msgs = await fetchConversationMessages(id);
      setConversationId(id);
      setInitialMessages(msgs);
      setCopiedMessages(new Set());
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const refreshConversations = async () => {
    const list = await fetchConversations();
    setConversations(list);
  };

  // Start a fresh conversation (clears history)
  const handleNewConversation = () => {
    const id = crypto.randomUUID();
    setConversationId(id);
    setInitialMessages([]);
    setCopiedMessages(new Set());
    refreshConversations();
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        !isAIEnabled && "pointer-events-none opacity-50",
      )}
    >
      <ChatHeader
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onConversationDeleted={refreshConversations}
        isLoadingConversation={isLoadingConversation}
      />
      <PromptInputProvider>
        <Chat
          conversationId={conversationId}
          initialMessages={initialMessages}
          isLoadingConversation={isLoadingConversation}
          copiedMessages={copiedMessages}
          setCopiedMessages={setCopiedMessages}
        />
      </PromptInputProvider>
      {/* Disclaimer */}
      <p className="text-muted-foreground p-2 text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
