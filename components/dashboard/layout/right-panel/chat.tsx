"use client";

import { useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

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
} from "@/components/ui/ai/prompt-input";
import { Response } from "@/components/ui/ai/response";

export function Chat() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const handleSubmit = (message: { text?: string }) => {
    if (message.text && message.text.trim().length >= 2) {
      sendMessage({ text: message.text });
      setInput("");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageAvatar
                src={
                  message.role === "user" ? "/user-avatar.png" : "/favicon.ico"
                }
                name={message.role === "user" ? "leo" : "Foliofox"}
              />
              <MessageContent>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Response key={`${message.id}-${i}`}>
                          {part.text}
                        </Response>
                      );
                    default:
                      return null;
                  }
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Foliofox..."
        />
        <PromptInputToolbar className="justify-end pt-0">
          <PromptInputSubmit
            disabled={input.trim().length < 2}
            status={status === "streaming" ? "streaming" : "ready"}
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
