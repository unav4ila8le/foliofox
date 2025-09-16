"use client";

import { useState, Fragment } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Check, Copy, RefreshCcw } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/ai/conversation";
import {
  Message,
  MessageContent,
  MessageLoading,
} from "@/components/ui/ai/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputBody,
  type PromptInputMessage,
} from "@/components/ui/ai/prompt-input";
import { Response } from "@/components/ui/ai/response";
import { Actions, Action } from "@/components/ui/ai/actions";
import { Suggestions, Suggestion } from "@/components/ui/ai/suggestions";

const suggestions = [
  "What would happen to my portfolio if the market crashes 30% tomorrow?",
  "How should I rebalance my portfolio to reduce risk while maintaining growth potential?",
  "What are the biggest vulnerabilities in my current investment strategy?",
  "Based on my holdings and portfolio history, what's my probability of reaching $1M net worth in 10 years?",
];

export function Chat() {
  const [input, setInput] = useState("");
  const [copiedMessages, setCopiedMessages] = useState<Set<string>>(new Set());

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const handleCopy = async (text: string, messageId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMessages((prev) => new Set(prev).add(messageId));
    setTimeout(() => {
      setCopiedMessages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }, 4000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);

    if (!hasText) {
      return;
    }

    sendMessage({ text: message.text || "" });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message, messageIndex) => (
            <Fragment key={message.id}>
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case "text":
                    const isLastMessage = messageIndex === messages.length - 1;
                    const isAssistant = message.role === "assistant";
                    const isCopied = copiedMessages.has(message.id);

                    return (
                      <Fragment key={`${message.id}-${i}`}>
                        <Message from={message.role}>
                          <MessageContent>
                            <Response>{part.text}</Response>
                          </MessageContent>
                        </Message>
                        {isAssistant && status !== "streaming" && (
                          <Actions className="-mt-2">
                            {isLastMessage && (
                              <Action
                                onClick={() => regenerate()}
                                tooltip="Regenerate response"
                              >
                                <RefreshCcw />
                              </Action>
                            )}
                            <Action
                              onClick={() => handleCopy(part.text, message.id)}
                              tooltip={
                                isCopied ? "Copied!" : "Copy to Clipboard"
                              }
                            >
                              {isCopied ? <Check /> : <Copy />}
                            </Action>
                          </Actions>
                        )}
                      </Fragment>
                    );
                  default:
                    return null;
                }
              })}
            </Fragment>
          ))}
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
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                onClick={handleSuggestionClick}
                suggestion={suggestion}
              />
            ))}
          </Suggestions>
        </div>
      )}

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody className="border-none">
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Foliofox..."
          />
        </PromptInputBody>
        <PromptInputToolbar className="justify-end">
          <PromptInputSubmit
            disabled={status === "streaming" ? false : input.trim().length < 2}
            type={status === "streaming" ? "button" : "submit"}
            onClick={status === "streaming" ? stop : undefined}
            status={status}
          />
        </PromptInputToolbar>
      </PromptInput>

      {/* Dislaimer */}
      <p className="text-muted-foreground text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
