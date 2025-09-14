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
  MessageAvatar,
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

export function Chat({ username }: { username: string }) {
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
                          <MessageAvatar
                            src={message.role === "user" ? "" : "/favicon.ico"}
                            name={
                              message.role === "user" ? username : "Foliofox"
                            }
                          />
                          <MessageContent>
                            <Response>{part.text}</Response>
                          </MessageContent>
                        </Message>
                        {isAssistant && isLastMessage && (
                          <Actions className="-mt-2">
                            <Action
                              onClick={() => regenerate()}
                              tooltip="Regenerate response"
                            >
                              <RefreshCcw />
                            </Action>
                            <Action
                              onClick={() => handleCopy(part.text, message.id)}
                              tooltip={
                                isCopied ? "Copied!" : "Copy to clipboard"
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

          {/* General loading state */}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageAvatar src="/favicon.ico" name="Foliofox" />
              <MessageContent className="flex flex-row items-center gap-3 text-sm">
                <span className="relative flex size-2.5 items-center justify-center">
                  <span className="bg-brand absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                  <span className="bg-brand relative inline-flex size-2 rounded-full"></span>
                </span>
                Thinking...
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

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
      <p className="text-muted-foreground mt-2 text-center text-xs">
        You are responsible for your investment decisions.
      </p>
    </div>
  );
}
