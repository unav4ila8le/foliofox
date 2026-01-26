"use client";

import {
  useState,
  Fragment,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Check, Copy, RefreshCcw, Sparkles } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

import { Button } from "@/components/ui/button";
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

import { cn } from "@/lib/utils";

const suggestions = [
  "What would happen to my portfolio if the market crashes 30% tomorrow?",
  "How should I rebalance my portfolio to reduce risk while maintaining growth potential?",
  "What are the biggest vulnerabilities in my current investment strategy?",
  "Based on my positions and portfolio history, what's my probability of reaching $1M net worth in 10 years?",
];

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
}

export function Chat({
  conversationId,
  initialMessages,
  isLoadingConversation,
  copiedMessages,
  setCopiedMessages,
  isAIEnabled,
}: ChatProps) {
  const [mode, setMode] = useState<Mode>("advisory");

  const { copyToClipboard } = useCopyToClipboard({ timeout: 4000 });
  const controller = usePromptInputController();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh transport reflects current mode + conversation
  const transport = new DefaultChatTransport({
    api: "/api/ai/chat",
    headers: { "x-ff-mode": mode, "x-ff-conversation-id": conversationId },
  });

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
  });

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
          className="gap-4 p-2"
          scrollClassName="![scrollbar-gutter:auto]"
        >
          {messages.length === 0 ? (
            isAIEnabled ? (
              <ConversationEmptyState
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
                          {isAssistant && status !== "streaming" && (
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
                    default:
                      if (isToolUIPart(part)) {
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
        <div className="space-y-2 px-2 pb-2">
          <p className="text-muted-foreground px-2 text-sm">Suggestions</p>
          <div className="space-y-1">
            {suggestions.map((suggestion) => (
              <Button
                disabled={!isAIEnabled}
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
      <div
        className={cn("px-2", !isAIEnabled && "pointer-events-none opacity-50")}
      >
        <PromptInput
          onSubmit={handleSubmit}
          className="bg-background rounded-md"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask Foliofox..."
              ref={textareaRef}
            />
          </PromptInputBody>

          <PromptInputFooter className="px-2 pb-2">
            <PromptInputTools>
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
                status === "streaming"
                  ? false
                  : controller.textInput.value.trim().length < 3
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
