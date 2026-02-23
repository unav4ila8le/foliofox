import type {
  PromptInputProps,
  PromptInputControllerProps,
  PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import type { Mode } from "@/server/ai/system-prompt";
import type { ChatStatus, UIMessage } from "ai";
import type { RefObject } from "react";

export interface ChatProps {
  conversationId: string;
  initialMessages: UIMessage[];
  isLoadingConversation: boolean;
  initialDraftInput?: string;
  initialDraftMode?: Mode;
  initialDraftFiles?: File[];
  isAIEnabled?: boolean;
  isAtConversationCap?: boolean;
  maxConversations?: number;
  hasCurrentConversationInHistory?: boolean;
  onConversationPersisted?: () => Promise<void> | void;
  onDraftInputChange?: (input: string) => void;
  onDraftModeChange?: (mode: Mode) => void;
  onDraftFilesChange?: (files: File[]) => void;
}

export interface ChatThreadProps {
  messages: UIMessage[];
  status: ChatStatus;
  isAIEnabled?: boolean;
  copiedMessages: Set<string>;
  onCopy: (text: string, messageId: string) => void;
  onRegenerate: () => void;
}

export interface ChatMessageProps {
  message: UIMessage;
  isLastMessage: boolean;
  status: ChatStatus;
  isAIEnabled?: boolean;
  isCopied: boolean;
  onCopy: (text: string, messageId: string) => void;
  onRegenerate: () => void;
}

export interface ChatComposerProps {
  status: ChatStatus;
  mode: Mode;
  isAIEnabled?: boolean;
  showProactiveCapAlert: boolean;
  controller: PromptInputControllerProps;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: (message: PromptInputMessage) => void;
  onModeChange: (value: Mode) => void;
  onStop: () => void;
  onInputError: NonNullable<PromptInputProps["onError"]>;
}

export interface ChatAlertsProps {
  showProactiveCapAlert: boolean;
  isCapError: boolean;
  chatErrorMessage: string | null;
  maxConversations: number;
}

export interface ChatSuggestionsProps {
  messageCount: number;
  isAIEnabled?: boolean;
  showProactiveCapAlert: boolean;
  onSuggestionClick: (suggestion: string) => void;
}

export type MessageSourcePart = Extract<
  UIMessage["parts"][number],
  { type: "source-url" | "source-document" }
>;

export type MessageFilePart = Extract<
  UIMessage["parts"][number],
  { type: "file" }
>;

export type GroupedMessagePart =
  | { kind: "reasoning"; texts: string[]; lastIndex: number }
  | { kind: "other"; part: UIMessage["parts"][number]; index: number };
