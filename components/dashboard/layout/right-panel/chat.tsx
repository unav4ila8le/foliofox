"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { FormEvent, KeyboardEvent, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim().length >= 2) {
        // Minimum 2 characters
        sendMessage({ text: input });
        setInput("");
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim().length >= 2) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {messages.map((message) => (
          <div key={message.id} className="whitespace-pre-wrap">
            {message.role === "user" ? "User: " : "AI: "}
            {message.parts.map((part, i) => {
              switch (part.type) {
                case "text":
                  return <div key={`${message.id}-${i}`}>{part.text}</div>;
              }
            })}
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-2">
        <form onSubmit={handleSubmit}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Foliofox..."
            className="max-h-32 min-h-[36px] resize-none"
            rows={1}
          />
        </form>
        <p className="text-center text-xs">
          You are responsible for your investment decisions.
        </p>
      </div>
    </div>
  );
}
