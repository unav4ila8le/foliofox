import { MessageLoading } from "@/components/ai-elements/message-loading";

import { ChatMessage } from "./message";
import type { ChatThreadProps } from "./types";

export function ChatThread({
  messages,
  status,
  isAIEnabled,
  hasPendingApproval,
  copiedMessages,
  onCopy,
  onRegenerate,
  onApprovalResponse,
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
          hasPendingApproval={hasPendingApproval}
          isCopied={copiedMessages.has(message.id)}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onApprovalResponse={onApprovalResponse}
        />
      ))}
      {status === "submitted" && <MessageLoading />}
    </>
  );
}
