import { isStaticToolUIPart } from "ai";
import { Check, Copy, RefreshCcw } from "lucide-react";
import { Fragment } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageAttachment,
  MessageAttachments,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

import type { ChatMessageProps } from "./types";
import {
  getSourceLabel,
  groupAdjacentParts,
  isMessageFilePart,
  isMessageSourcePart,
} from "./utils";

export function ChatMessage({
  message,
  isLastMessage,
  status,
  isAIEnabled,
  isCopied,
  onCopy,
  onRegenerate,
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = status === "streaming";
  const fileParts = message.parts.filter(isMessageFilePart);
  const sourceParts = message.parts.filter(isMessageSourcePart);

  return (
    <>
      {message.role === "user" && fileParts.length > 0 && (
        <MessageAttachments>
          {fileParts.map((attachment, attachmentIndex) => (
            <MessageAttachment
              key={`${message.id}-attachment-${attachmentIndex}`}
              data={attachment}
            />
          ))}
        </MessageAttachments>
      )}

      {isAssistant && sourceParts.length > 0 && (
        <Sources>
          <SourcesTrigger count={sourceParts.length} />
          <SourcesContent>
            {sourceParts.map((part, sourceIndex) => {
              if (part.type === "source-url") {
                return (
                  <Source
                    key={`${message.id}-source-${sourceIndex}`}
                    href={part.url}
                    title={getSourceLabel(part.url, part.title)}
                  />
                );
              }

              return (
                <Source
                  key={`${message.id}-source-doc-${sourceIndex}`}
                  title={part.title || part.filename || "Document source"}
                />
              );
            })}
          </SourcesContent>
        </Sources>
      )}

      {groupAdjacentParts(message.parts).map((group) => {
        if (group.kind === "reasoning") {
          const mergedText = group.texts.filter(Boolean).join("\n\n");
          const isLastPart = group.lastIndex === message.parts.length - 1;
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

        const { part, index } = group;
        switch (part.type) {
          case "text":
            return (
              <Fragment key={`${message.id}-${index}`}>
                <Message
                  from={message.role}
                  className={cn("max-w-[90%]", isAssistant && "max-w-full")}
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
                        onClick={() => onRegenerate()}
                        tooltip="Regenerate response"
                        disabled={!isAIEnabled}
                      >
                        <RefreshCcw className="size-3.5" />
                      </MessageAction>
                    )}
                    <MessageAction
                      onClick={() => onCopy(part.text, message.id)}
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
          case "source-document":
            return null;
          default:
            if (isStaticToolUIPart(part)) {
              return (
                <Tool key={`${message.id}-part-${index}`} className="mb-0">
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
    </>
  );
}
