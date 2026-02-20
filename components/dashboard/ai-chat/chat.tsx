"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Logomark } from "@/components/ui/logos/logomark";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import {
  AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
  isConversationCapErrorMessage,
} from "@/lib/ai/chat-errors";
import { cn } from "@/lib/utils";
import type { Mode } from "@/server/ai/system-prompt";

import { ChatAlerts } from "./alerts";
import { ChatComposer } from "./composer";
import { DisabledState } from "./disabled-state";
import { ChatSuggestions } from "./suggestions";
import { ChatThread } from "./thread";
import type { ChatProps } from "./types";

export function Chat({
  conversationId,
  initialMessages,
  isLoadingConversation,
  isAIEnabled,
  isAtConversationCap,
  maxConversations = 0,
  hasCurrentConversationInHistory,
  onConversationPersisted,
}: ChatProps) {
  const [mode, setMode] = useState<Mode>("advisory");
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);
  const [copiedMessages, setCopiedMessages] = useState<Set<string>>(new Set());

  const { copyToClipboard } = useCopyToClipboard({ timeout: 4000 });
  const controller = usePromptInputController();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh transport reflects current mode + conversation.
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/ai/chat",
      headers: { "x-ff-mode": mode, "x-ff-conversation-id": conversationId },
    });
  }, [mode, conversationId]);

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onError: (error) => {
      // Normalize backend cap error into a stable, user-friendly message.
      const message = isConversationCapErrorMessage(error.message)
        ? AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE
        : error.message;

      setChatErrorMessage(message);
    },
    onFinish: async ({ isAbort, isError }) => {
      if (isAbort || isError) return;

      setChatErrorMessage(null);
      await onConversationPersisted?.();
    },
  });

  const showProactiveCapAlert =
    Boolean(isAIEnabled) &&
    Boolean(isAtConversationCap) &&
    // New unsaved thread + cap reached -> block sends and guide deletion.
    !hasCurrentConversationInHistory;
  const isCapError = chatErrorMessage
    ? isConversationCapErrorMessage(chatErrorMessage)
    : false;

  // Quick-send a suggested prompt
  const handleSuggestionClick = (suggestion: string) => {
    if (showProactiveCapAlert) return;

    setChatErrorMessage(null);
    sendMessage({ text: suggestion });
  };

  // Copy message text with a temporary visual state
  const handleCopy = (text: string, messageId: string) => {
    copyToClipboard(text);
    setCopiedMessages((previousState) => new Set(previousState).add(messageId));
    setTimeout(() => {
      setCopiedMessages((previousState) => {
        const nextState = new Set(previousState);
        nextState.delete(messageId);
        return nextState;
      });
    }, 4000);
  };

  // Submit user input to the chat
  const handleSubmit = (message: PromptInputMessage) => {
    if (showProactiveCapAlert) {
      return;
    }

    const normalizedText = message.text.trim();
    const hasText = normalizedText.length > 0;
    const hasFiles = message.files.length > 0;

    if (!hasText && !hasFiles) {
      return;
    }

    setChatErrorMessage(null);
    if (hasText && hasFiles) {
      sendMessage({ text: normalizedText, files: message.files });
      return;
    }

    if (hasText) {
      sendMessage({ text: normalizedText });
      return;
    }

    sendMessage({ files: message.files });
  };

  return (
    <>
      <Conversation
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          isLoadingConversation && "pointer-events-none opacity-50",
        )}
      >
        <ConversationContent
          className="gap-4"
          scrollClassName="![scrollbar-gutter:auto]"
        >
          {messages.length === 0 ? (
            isAIEnabled ? (
              <ConversationEmptyState
                className="p-4"
                icon={
                  <Logomark width={64} className="text-muted-foreground/25" />
                }
                title="Foliofox AI Advisor"
                description="Type a message below to start a conversation"
              />
            ) : (
              <DisabledState />
            )
          ) : (
            <ChatThread
              messages={messages}
              status={status}
              isAIEnabled={isAIEnabled}
              copiedMessages={copiedMessages}
              onCopy={handleCopy}
              onRegenerate={regenerate}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <ChatSuggestions
        messageCount={messages.length}
        isAIEnabled={isAIEnabled}
        showProactiveCapAlert={showProactiveCapAlert}
        onSuggestionClick={handleSuggestionClick}
      />

      <ChatAlerts
        showProactiveCapAlert={showProactiveCapAlert}
        isCapError={isCapError}
        chatErrorMessage={chatErrorMessage}
        maxConversations={maxConversations}
      />

      <ChatComposer
        status={status}
        mode={mode}
        isAIEnabled={isAIEnabled}
        showProactiveCapAlert={showProactiveCapAlert}
        controller={controller}
        textareaRef={textareaRef}
        onSubmit={handleSubmit}
        onModeChange={setMode}
        onStop={stop}
      />
    </>
  );
}
