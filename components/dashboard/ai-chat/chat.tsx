"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useMemo, useRef, useState, useEffect } from "react";

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
import {
  CHAT_FILE_ALLOWED_TYPES_TEXT,
  MAX_CHAT_FILE_SIZE_BYTES,
  MAX_CHAT_FILE_SIZE_MB,
  MAX_CHAT_FILES_PER_MESSAGE,
  estimateDataUrlBytes,
  isAllowedChatFileMediaType,
} from "@/lib/ai/chat-file-upload-guardrails";
import { cn } from "@/lib/utils";
import type { Mode } from "@/server/ai/system-prompt";

import { ChatAlerts } from "./alerts";
import { ChatComposer } from "./composer";
import { DisabledState } from "./disabled-state";
import { ChatSuggestions } from "./suggestions";
import { ChatThread } from "./thread";
import type { ChatProps } from "./types";

function buildClientFileValidationError(
  fileParts: FileUIPart[],
): string | null {
  if (fileParts.length > MAX_CHAT_FILES_PER_MESSAGE) {
    return `You can upload up to ${MAX_CHAT_FILES_PER_MESSAGE} files per message.`;
  }

  for (let index = 0; index < fileParts.length; index += 1) {
    const filePart = fileParts[index];
    if (!filePart) {
      continue;
    }

    if (!isAllowedChatFileMediaType(filePart.mediaType ?? "")) {
      return `One or more files have an unsupported type. Allowed file types: ${CHAT_FILE_ALLOWED_TYPES_TEXT}.`;
    }

    if (!filePart.url.startsWith("data:")) {
      return "Invalid file payload format.";
    }

    const estimatedBytes = estimateDataUrlBytes(filePart.url);
    if (estimatedBytes == null) {
      return "Invalid file payload.";
    }

    if (estimatedBytes > MAX_CHAT_FILE_SIZE_BYTES) {
      const fileLabel = filePart.filename || `File ${index + 1}`;
      return `${fileLabel} exceeds the ${MAX_CHAT_FILE_SIZE_MB}MB limit.`;
    }
  }

  return null;
}

async function estimateAttachmentBytes(url: string): Promise<number | null> {
  if (url.startsWith("data:")) {
    return estimateDataUrlBytes(url);
  }

  if (!url.startsWith("blob:")) {
    return null;
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return null;
  }
}

function mapPromptInputErrorToMessage(
  errorCode: "accept" | "max_files" | "max_file_size",
): string {
  switch (errorCode) {
    case "accept":
      return `One or more files have an unsupported type. Allowed file types: ${CHAT_FILE_ALLOWED_TYPES_TEXT}.`;
    case "max_files":
      return `You can upload up to ${MAX_CHAT_FILES_PER_MESSAGE} files per message.`;
    case "max_file_size":
      return `Each file must be ${MAX_CHAT_FILE_SIZE_MB}MB or smaller.`;
    default:
      return "Invalid file payload.";
  }
}

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
  const attachmentFiles = controller.attachments.files;
  const removeAttachment = controller.attachments.remove;

  useEffect(() => {
    const queueChatError = (message: string) => {
      queueMicrotask(() => {
        setChatErrorMessage(message);
      });
    };

    const overflowAttachments = attachmentFiles.slice(
      MAX_CHAT_FILES_PER_MESSAGE,
    );
    if (overflowAttachments.length > 0) {
      overflowAttachments.forEach((attachment) => {
        removeAttachment(attachment.id);
      });
      queueChatError(
        `You can upload up to ${MAX_CHAT_FILES_PER_MESSAGE} files per message.`,
      );
    }

    for (const attachment of attachmentFiles) {
      if (!isAllowedChatFileMediaType(attachment.mediaType ?? "")) {
        removeAttachment(attachment.id);
        queueChatError(
          `One or more files have an unsupported type. Allowed file types: ${CHAT_FILE_ALLOWED_TYPES_TEXT}.`,
        );
      }
    }

    let didCancel = false;
    const validateAttachmentSizes = async () => {
      for (const attachment of attachmentFiles) {
        const estimatedBytes = await estimateAttachmentBytes(attachment.url);
        if (didCancel) {
          return;
        }

        if (estimatedBytes == null) {
          removeAttachment(attachment.id);
          queueChatError("Invalid file payload.");
          continue;
        }

        if (estimatedBytes > MAX_CHAT_FILE_SIZE_BYTES) {
          removeAttachment(attachment.id);
          const fileLabel = attachment.filename || "Attachment";
          queueChatError(
            `${fileLabel} exceeds the ${MAX_CHAT_FILE_SIZE_MB}MB limit.`,
          );
        }
      }
    };

    void validateAttachmentSizes();

    return () => {
      didCancel = true;
    };
  }, [attachmentFiles, removeAttachment]);

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
    const hasAnyText = normalizedText.length > 0;
    const hasLongEnoughText = normalizedText.length >= 2;
    const hasFiles = message.files.length > 0;

    if (!hasFiles && !hasLongEnoughText) {
      return;
    }

    const fileValidationError = buildClientFileValidationError(message.files);
    if (fileValidationError) {
      setChatErrorMessage(fileValidationError);
      return;
    }

    setChatErrorMessage(null);
    if (hasFiles && hasAnyText) {
      sendMessage({ text: normalizedText, files: message.files });
      return;
    }

    if (hasFiles) {
      sendMessage({ files: message.files });
      return;
    }

    sendMessage({ text: normalizedText });
  };

  const handlePromptInputError = ({
    code,
  }: {
    code: "accept" | "max_files" | "max_file_size";
    message: string;
  }) => {
    setChatErrorMessage(mapPromptInputErrorToMessage(code));
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
        onInputError={handlePromptInputError}
      />
    </>
  );
}
