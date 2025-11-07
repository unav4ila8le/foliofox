"use client";

import { useState, useEffect, Fragment } from "react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Check, Copy, RefreshCcw } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageLoading } from "@/components/ai-elements/message-loading";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ui/ai/response";
import { Actions, Action } from "@/components/ui/ai/actions";
import { Logomark } from "@/components/ui/logos/logomark";
import { ChatHeader } from "./header";

import { fetchConversations } from "@/server/ai/conversations/fetch";
import { fetchConversationMessages } from "@/server/ai/messages/fetch";
import type { Mode } from "@/server/ai/system-prompt";
import { cn } from "@/lib/utils";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

const suggestions = [
  "What would happen to my portfolio if the market crashes 30% tomorrow?",
  "How should I rebalance my portfolio to reduce risk while maintaining growth potential?",
  "What are the biggest vulnerabilities in my current investment strategy?",
  "Based on my positions and portfolio history, what's my probability of reaching $1M net worth in 10 years?",
];

export function Chat() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("advisory");
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

  const { copyToClipboard } = useCopyToClipboard({ timeout: 4000 });

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

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      headers: { "x-ff-mode": mode, "x-ff-conversation-id": conversationId },
    }),
  });

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

  // Quick-send a suggested prompt
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  // Copy message text with a temporary visual state
  const handleCopy = (text: string, messageId: string) => {
    copyToClipboard(text);
    setCopiedMessages((prev) => new Set(prev).add(messageId));
    setTimeout(() => {
      setCopiedMessages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }, 4000);
  };

  // Submit user input to the chat
  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);

    if (!hasText) {
      return;
    }

    sendMessage({ text: message.text || "" });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <ChatHeader
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onConversationDeleted={refreshConversations}
        isLoadingConversation={isLoadingConversation}
      />

      {/* Conversation */}
      <Conversation
        className={cn(
          isLoadingConversation && "pointer-events-none opacity-50",
        )}
      >
        <ConversationContent className="gap-4 p-2">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <Logomark width={64} className="text-muted-foreground/25" />
              }
              title="Foliofox AI Advisor"
              description="Type a message below to start a conversation"
            />
          ) : (
            messages.map((message, messageIndex) => (
              <Fragment key={message.id}>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      const isLastMessage =
                        messageIndex === messages.length - 1;
                      const isAssistant = message.role === "assistant";
                      const isCopied = copiedMessages.has(message.id);

                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role} className="max-w-[90%]">
                            <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                              <Response>{part.text}</Response>
                            </MessageContent>
                          </Message>
                          {isAssistant && status !== "streaming" && (
                            <Actions>
                              {isLastMessage && (
                                <Action
                                  onClick={() => regenerate()}
                                  tooltip="Regenerate response"
                                >
                                  <RefreshCcw />
                                </Action>
                              )}
                              <Action
                                onClick={() =>
                                  handleCopy(part.text, message.id)
                                }
                                tooltip={isCopied ? "Copied!" : "Copy"}
                              >
                                {isCopied ? <Check /> : <Copy />}
                              </Action>
                            </Actions>
                          )}
                        </Fragment>
                      );
                    default:
                      if (isToolUIPart(part)) {
                        return (
                          <Tool
                            key={`${message.id}-part-${i}`}
                            className="mb-0"
                          >
                            <ToolHeader type={part.type} state={part.state} />
                            <ToolContent>
                              <ToolInput input={part.input} />
                              <ToolOutput
                                output={part.output}
                                errorText={part.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }

                      return null;
                  }
                })}
              </Fragment>
            ))
          )}
          {(status === "submitted" || status === "streaming") && (
            <MessageLoading status={status} className="mb-2 ps-1" />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground px-2 text-sm">Suggestions</p>
          <div className="space-y-1">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                variant="ghost"
                className="h-auto p-2 text-start whitespace-normal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Foliofox..."
          />
        </PromptInputBody>
        <PromptInputTools>
          <PromptInputSelect
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
          >
            <PromptInputSelectTrigger>
              <PromptInputSelectValue placeholder="Mode" />
            </PromptInputSelectTrigger>
            <PromptInputSelectContent>
              <PromptInputSelectItem value="educational">
                Educational
              </PromptInputSelectItem>
              <PromptInputSelectItem value="advisory">
                Advisory
              </PromptInputSelectItem>
              <PromptInputSelectItem value="unhinged">
                Unhinged
              </PromptInputSelectItem>
            </PromptInputSelectContent>
          </PromptInputSelect>
          <PromptInputSubmit
            disabled={status === "streaming" ? false : input.trim().length < 2}
            type={status === "streaming" ? "button" : "submit"}
            onClick={status === "streaming" ? stop : undefined}
            status={status}
          />
        </PromptInputTools>
      </PromptInput>

      {/* Dislaimer */}
      <p className="text-muted-foreground mt-2 text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
