import { MessageLoading } from "@/components/ai-elements/message-loading";

import { ChatMessage } from "./message";
import type { ChatThreadProps } from "./types";

export function ChatThread({
  messages,
  status,
  isAIEnabled,
  copiedMessages,
  onCopy,
  onRegenerate,
}: ChatThreadProps) {
  return (
    <>
      {messages.map((message, messageIndex) => (
        <ChatMessage
          key={message.id}
          message={message}
          isLastMessage={messageIndex === messages.length - 1}
          status={status}
          isAIEnabled={isAIEnabled}
          isCopied={copiedMessages.has(message.id)}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
        />
      ))}
      {status === "submitted" && <MessageLoading />}
    </>
  );
}
