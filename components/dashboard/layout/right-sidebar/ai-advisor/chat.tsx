"use client";

import {
  useState,
  useMemo,
  Fragment,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DefaultChatTransport, isStaticToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { MessageLoading } from "@/components/ai-elements/message-loading";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputBody,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  PromptInputFooter,
  usePromptInputController,
  PromptInputSpeechButton,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Logomark } from "@/components/ui/logos/logomark";
import { AISettingsDialog } from "@/components/features/ai-settings/dialog";

import type { Mode } from "@/server/ai/system-prompt";
import {
  AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
  isConversationCapErrorMessage,
} from "@/lib/ai/chat-errors";

import { cn } from "@/lib/utils";

/** Merge consecutive reasoning parts into groups, preserving other parts. */
function groupAdjacentParts(parts: UIMessage["parts"]) {
  const groups: Array<
    | { kind: "reasoning"; texts: string[]; lastIndex: number }
    | { kind: "other"; part: UIMessage["parts"][number]; index: number }
  > = [];

  parts.forEach((part, i) => {
    if (part.type === "reasoning") {
      const prev = groups.at(-1);
      if (prev?.kind === "reasoning") {
        prev.texts.push(part.text);
        prev.lastIndex = i;
      } else {
        groups.push({ kind: "reasoning", texts: [part.text], lastIndex: i });
      }
    } else {
      groups.push({ kind: "other", part, index: i });
    }
  });

  return groups;
}

const suggestions = [
  "What would happen to my portfolio if the market crashes 30% tomorrow?",
  "How should I rebalance my portfolio to reduce risk while maintaining growth potential?",
  "What are the biggest vulnerabilities in my current investment strategy?",
  "Based on my positions and portfolio history, what's my probability of reaching $1M net worth in 10 years?",
];

function getSourceLabel(url: string, title?: string) {
  if (title?.trim()) {
    return title;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function DisabledState() {
  const [openAISettings, setOpenAISettings] = useState(false);

  return (
    <div className="p-4 text-center">
      <ConversationEmptyState
        icon={<Logomark width={64} className="text-muted-foreground/25" />}
        title="Foliofox AI Advisor"
        description="Share your portfolio and financial profile to get tailored portfolio insights and advice."
        className="p-0 pb-3"
      />
      <p className="text-muted-foreground mb-2 text-sm">
        Turn on AI data sharing in settings to unlock personalized answers.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpenAISettings(true)}
      >
        <Sparkles /> Enable data sharing
      </Button>
      <AISettingsDialog
        open={openAISettings}
        onOpenChange={setOpenAISettings}
      />
    </div>
  );
}

interface ChatProps {
  conversationId: string;
  initialMessages: UIMessage[];
  isLoadingConversation: boolean;
  copiedMessages: Set<string>;
  setCopiedMessages: Dispatch<SetStateAction<Set<string>>>;
  isAIEnabled?: boolean;
  isAtConversationCap?: boolean;
  maxConversations?: number;
  hasCurrentConversationInHistory?: boolean;
  onConversationPersisted?: () => Promise<void> | void;
}

export function Chat({
  conversationId,
  initialMessages,
  isLoadingConversation,
  copiedMessages,
  setCopiedMessages,
  isAIEnabled,
  isAtConversationCap,
  maxConversations = 0,
  hasCurrentConversationInHistory,
  onConversationPersisted,
}: ChatProps) {
  const [mode, setMode] = useState<Mode>("advisory");
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);

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
      toast.error(message);
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
      {/* Conversation */}
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
            messages.map((message, messageIndex) => {
              const isLastMessage = messageIndex === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const isStreaming = status === "streaming";
              const isCopied = copiedMessages.has(message.id);

              return (
                <Fragment key={message.id}>
                  {groupAdjacentParts(message.parts).map((group) => {
                    if (group.kind === "reasoning") {
                      const mergedText = group.texts
                        .filter(Boolean)
                        .join("\n\n");
                      const isLastPart =
                        group.lastIndex === message.parts.length - 1;
                      const isReasoningStreaming =
                        isLastMessage && isStreaming && isLastPart;

                      return (
                        <Reasoning
                          key={`${message.id}-r-${group.lastIndex}`}
                          className="mb-0 w-full"
                          isStreaming={isReasoningStreaming}
                        >
                          <ReasoningTrigger />
                          {mergedText && (
                            <ReasoningContent className="mt-2 text-xs *:space-y-2">
                              {mergedText}
                            </ReasoningContent>
                          )}
                        </Reasoning>
                      );
                    }

                    const { part, index: i } = group;
                    switch (part.type) {
                      case "text":
                        return (
                          <Fragment key={`${message.id}-${i}`}>
                            <Message
                              from={message.role}
                              className={cn(
                                "max-w-[90%]",
                                isAssistant && "max-w-full",
                              )}
                            >
                              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                                {isAssistant ? (
                                  <MessageResponse>{part.text}</MessageResponse>
                                ) : (
                                  part.text
                                )}
                              </MessageContent>
                            </Message>
                            {isAssistant && !isStreaming && (
                              <MessageActions className="-mt-3">
                                {isLastMessage && (
                                  <MessageAction
                                    onClick={() => regenerate()}
                                    tooltip="Regenerate response"
                                    disabled={!isAIEnabled}
                                  >
                                    <RefreshCcw className="size-3.5" />
                                  </MessageAction>
                                )}
                                <MessageAction
                                  onClick={() =>
                                    handleCopy(part.text, message.id)
                                  }
                                  tooltip={isCopied ? "Copied!" : "Copy"}
                                >
                                  {isCopied ? (
                                    <Check className="size-3.5" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                </MessageAction>
                              </MessageActions>
                            )}
                          </Fragment>
                        );
                      case "source-url":
                        return (
                          <Message
                            key={`${message.id}-source-${i}`}
                            from="assistant"
                            className="max-w-full"
                          >
                            <MessageContent>
                              <a
                                href={part.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3.5" />
                                {getSourceLabel(part.url, part.title)}
                              </a>
                            </MessageContent>
                          </Message>
                        );
                      case "source-document":
                        return (
                          <Message
                            key={`${message.id}-source-doc-${i}`}
                            from="assistant"
                            className="max-w-full"
                          >
                            <MessageContent>
                              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                                <FileText className="size-3.5" />
                                {part.title ||
                                  part.filename ||
                                  "Document source"}
                              </span>
                            </MessageContent>
                          </Message>
                        );
                      default:
                        if (isStaticToolUIPart(part)) {
                          return (
                            <Tool
                              key={`${message.id}-part-${i}`}
                              className="mb-0"
                            >
                              <ToolHeader
                                type={part.type}
                                state={part.state}
                                className="truncate"
                              />
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
              );
            })
          )}
          {status === "submitted" && <MessageLoading />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-2 px-4 pb-2">
          <p className="text-muted-foreground px-2 text-sm">Suggestions</p>
          <div className="space-y-1">
            {suggestions.map((suggestion) => (
              <Button
                disabled={!isAIEnabled || showProactiveCapAlert}
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                variant="ghost"
                className="h-auto w-full justify-stretch p-2 text-start whitespace-normal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Alert */}
      {(showProactiveCapAlert || chatErrorMessage) && (
        <div className="px-4 pb-2">
          <Alert
            variant={
              showProactiveCapAlert || isCapError ? "default" : "destructive"
            }
          >
            <TriangleAlert />
            <AlertTitle>
              {showProactiveCapAlert || isCapError
                ? "Conversation limit reached"
                : "Chat request failed"}
            </AlertTitle>
            <AlertDescription>
              {showProactiveCapAlert
                ? `You have ${maxConversations} saved conversations. Delete an older conversation from history to start a new one.`
                : chatErrorMessage}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Prompt Input */}
      <div
        className={cn(
          "px-4",
          !isAIEnabled ||
            (showProactiveCapAlert && "pointer-events-none opacity-50"),
        )}
      >
        <PromptInput
          onSubmit={handleSubmit}
          className="bg-background rounded-md"
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>

          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask Foliofox..."
              ref={textareaRef}
            />
          </PromptInputBody>

          <PromptInputFooter className="px-2 pb-2">
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputSpeechButton
                textareaRef={textareaRef}
                onTranscriptionChange={(text) => {
                  controller.textInput.setInput(text);
                }}
              />
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
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              disabled={
                showProactiveCapAlert
                  ? true
                  : status === "streaming"
                    ? false
                    : controller.textInput.value.trim().length === 0 &&
                      controller.attachments.files.length === 0
              }
              onClick={(e) => {
                if (status === "streaming") {
                  e.preventDefault();
                  stop();
                }
              }}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
