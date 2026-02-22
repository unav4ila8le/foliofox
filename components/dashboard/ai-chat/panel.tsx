"use client";

import type { UIMessage } from "ai";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { Chat } from "@/components/dashboard/ai-chat/chat";
import { ChatHeader } from "@/components/dashboard/ai-chat/header";

import { fetchConversationMessages } from "@/server/ai/messages/fetch";
import {
  fetchConversations,
  type ConversationsResult,
} from "@/server/ai/conversations/fetch";

import { buildAIChatExpandHref } from "./navigation";
import { useAIChatState } from "./provider";

interface AIChatPanelProps {
  layoutMode: "sidebar" | "page";
  isAIEnabled?: boolean;
  initialConversationId?: string | null;
  moveToSidebarHref?: string | null;
}

export function AIChatPanel({
  layoutMode,
  isAIEnabled,
  initialConversationId,
  moveToSidebarHref,
}: AIChatPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    activeConversationId,
    draftsByConversationId,
    setActiveConversationId,
    setDraftInput,
    setDraftMode,
    setDraftFiles,
  } = useAIChatState();
  const normalizedInitialConversationId = initialConversationId?.trim() || null;
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
  const lastLoadedConversationIdRef = useRef<string | null>(null);
  const lastAppliedInitialConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (normalizedInitialConversationId) {
      if (
        lastAppliedInitialConversationIdRef.current !==
        normalizedInitialConversationId
      ) {
        lastAppliedInitialConversationIdRef.current =
          normalizedInitialConversationId;
        setActiveConversationId(normalizedInitialConversationId);
      }
      return;
    }

    lastAppliedInitialConversationIdRef.current = null;
    if (!activeConversationId) {
      setActiveConversationId(uuidv4());
    }
  }, [
    normalizedInitialConversationId,
    activeConversationId,
    setActiveConversationId,
  ]);

  const conversationId =
    activeConversationId ?? normalizedInitialConversationId;

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

  // Load conversation list on mount.
  useEffect(() => {
    let didCancel = false;

    void fetchConversations()
      .then((result) => {
        if (!didCancel) {
          applyConversationsResult(result);
        }
      })
      .catch(() => {
        // Ignore load errors; header will show empty state.
      });

    return () => {
      didCancel = true;
    };
  }, [applyConversationsResult]);

  const hasCurrentConversationInHistory = conversations.some(
    (conversation) =>
      conversationId != null && conversation.id === conversationId,
  );
  const shouldLoadConversationFromDirectLink =
    normalizedInitialConversationId != null &&
    conversationId === normalizedInitialConversationId;

  useEffect(() => {
    let didCancel = false;

    if (!conversationId) {
      lastLoadedConversationIdRef.current = null;
      queueMicrotask(() => {
        if (!didCancel) {
          setIsLoadingConversation(false);
          setInitialMessages([]);
        }
      });
      return;
    }

    if (
      !hasCurrentConversationInHistory &&
      !shouldLoadConversationFromDirectLink
    ) {
      lastLoadedConversationIdRef.current = null;
      queueMicrotask(() => {
        if (!didCancel) {
          setIsLoadingConversation(false);
          setInitialMessages([]);
        }
      });
      return;
    }

    if (lastLoadedConversationIdRef.current === conversationId) {
      return;
    }

    queueMicrotask(() => {
      if (!didCancel) {
        setIsLoadingConversation(true);
      }
    });

    void fetchConversationMessages(conversationId)
      .then((messages) => {
        if (didCancel) {
          return;
        }

        lastLoadedConversationIdRef.current = conversationId;
        setInitialMessages(messages);
      })
      .catch(() => {
        if (didCancel) {
          return;
        }

        lastLoadedConversationIdRef.current = conversationId;
        setInitialMessages([]);
      })
      .finally(() => {
        if (didCancel) {
          return;
        }

        setIsLoadingConversation(false);
      });

    return () => {
      didCancel = true;
    };
  }, [
    conversationId,
    hasCurrentConversationInHistory,
    shouldLoadConversationFromDirectLink,
  ]);

  // Switch to an existing conversation (loads history).
  const handleSelectConversation = (id: string) => {
    lastLoadedConversationIdRef.current = null;
    setInitialMessages([]);
    setActiveConversationId(id);
  };

  // Start a fresh conversation (clears history).
  const handleNewConversation = () => {
    // Guard new thread creation in UI when cap is reached.
    if (isAtConversationCap) return;

    const id = uuidv4();
    lastLoadedConversationIdRef.current = null;
    setActiveConversationId(id);
    setInitialMessages([]);
  };

  const currentPathWithQuery = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const modeActionHref = useMemo(() => {
    if (layoutMode === "page") {
      return moveToSidebarHref ?? null;
    }

    if (!conversationId) {
      return null;
    }

    return buildAIChatExpandHref({
      conversationId,
      from: currentPathWithQuery,
    });
  }, [layoutMode, moveToSidebarHref, conversationId, currentPathWithQuery]);

  const currentDraft =
    conversationId != null ? draftsByConversationId[conversationId] : undefined;
  const initialDraftInput = currentDraft?.input ?? "";
  const initialDraftMode = currentDraft?.mode ?? "advisory";
  const initialDraftFiles = currentDraft?.files ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        layoutMode={layoutMode}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onConversationDeleted={refreshConversations}
        isLoadingConversation={isLoadingConversation}
        isAIEnabled={isAIEnabled}
        isAtConversationCap={isAtConversationCap}
        maxConversations={maxConversations}
        totalConversations={totalConversations}
        modeActionHref={modeActionHref}
      />
      <PromptInputProvider>
        {conversationId ? (
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
            initialDraftInput={initialDraftInput}
            initialDraftMode={initialDraftMode}
            initialDraftFiles={initialDraftFiles}
            onDraftInputChange={(input) => {
              setDraftInput(conversationId, input);
            }}
            onDraftModeChange={(mode) => {
              setDraftMode(conversationId, mode);
            }}
            onDraftFilesChange={(files) => {
              setDraftFiles(conversationId, files);
            }}
          />
        ) : null}
      </PromptInputProvider>
      <p className="text-muted-foreground p-2 text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
