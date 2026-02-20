"use client";

import { useState, useEffect, useCallback } from "react";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { ChatHeader } from "./header";
import { Chat } from "@/components/dashboard/ai-chat/chat";

import { fetchConversationMessages } from "@/server/ai/messages/fetch";
import {
  fetchConversations,
  type ConversationsResult,
} from "@/server/ai/conversations/fetch";

import type { UIMessage } from "ai";

import { v4 as uuidv4 } from "uuid";

export function AIAdvisor() {
  // AI enabled
  const { profile } = useDashboardData();
  const isAIEnabled = profile.data_sharing_consent;

  // Current conversation identifier (used to scope/useChat state)
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [conversations, setConversations] = useState<
    {
      id: string;
      title: string;
      updatedAt: string;
    }[]
  >([]);
  const [totalConversations, setTotalConversations] = useState(0);
  const [isAtConversationCap, setIsAtConversationCap] = useState(false);
  const [maxConversations, setMaxConversations] = useState(0);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const applyConversationsResult = useCallback(
    (result: ConversationsResult) => {
      setConversations(result.conversations);
      setTotalConversations(result.totalCount);
      setIsAtConversationCap(result.isAtCap);
      setMaxConversations(result.maxConversations);
    },
    [],
  );

  const refreshConversations = useCallback(async () => {
    // Single refresh source for list + cap metadata.
    const result = await fetchConversations();
    applyConversationsResult(result);
  }, [applyConversationsResult]);

  // Load conversation list on mount
  useEffect(() => {
    void refreshConversations().catch(() => {
      // Ignore load errors; header will show empty state.
    });
  }, [refreshConversations]);

  // Switch to an existing conversation (loads history)
  const handleSelectConversation = async (id: string) => {
    setIsLoadingConversation(true);
    try {
      const msgs = await fetchConversationMessages(id);
      setConversationId(id);
      setInitialMessages(msgs);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Start a fresh conversation (clears history)
  const handleNewConversation = () => {
    // Guard new thread creation in UI when cap is reached.
    if (isAtConversationCap) return;

    const id = uuidv4();
    setConversationId(id);
    setInitialMessages([]);
  };

  const hasCurrentConversationInHistory = conversations.some(
    (conversation) => conversation.id === conversationId,
  );

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onConversationDeleted={refreshConversations}
        isLoadingConversation={isLoadingConversation}
        isAIEnabled={isAIEnabled}
        isAtConversationCap={isAtConversationCap}
        maxConversations={maxConversations}
        totalConversations={totalConversations}
      />
      <PromptInputProvider>
        <Chat
          key={conversationId}
          conversationId={conversationId}
          initialMessages={initialMessages}
          isLoadingConversation={isLoadingConversation}
          isAIEnabled={isAIEnabled}
          isAtConversationCap={isAtConversationCap}
          maxConversations={maxConversations}
          hasCurrentConversationInHistory={hasCurrentConversationInHistory}
          onConversationPersisted={refreshConversations}
        />
      </PromptInputProvider>
      {/* Disclaimer */}
      <p className="text-muted-foreground p-2 text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
