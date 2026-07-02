import { isStaticToolUIPart } from "ai";
import { Check, Copy, RefreshCcw } from "lucide-react";
import { Fragment } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Attachment,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments";
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
  isMessageFilePart,
  isMessageSourcePart,
} from "./utils";
import { getToolOutputPreview } from "./tool-output-preview";

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
  const reasoningParts = message.parts.filter(
    (part) => part.type === "reasoning",
  );
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";

  return (
    <>
      {message.role === "user" && fileParts.length > 0 && (
        <Attachments variant="grid">
          {fileParts.map((attachment, attachmentIndex) => {
            const attachmentId = `${message.id}-attachment-${attachmentIndex}`;

            return (
              <Attachment
                key={attachmentId}
                data={{ ...attachment, id: attachmentId }}
              >
                <AttachmentPreview />
              </Attachment>
            );
          })}
        </Attachments>
      )}

      {isAssistant && sourceParts.length > 0 && (
        <Sources className="notranslate" translate="no">
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
                <div
                  key={`${message.id}-source-doc-${sourceIndex}`}
                  className="flex items-center gap-2"
                >
                  <span className="block font-medium">
                    {part.title || part.filename || "Document source"}
                  </span>
                </div>
              );
            })}
          </SourcesContent>
        </Sources>
      )}

      {reasoningParts.length > 0 && (
        <Reasoning
          className="notranslate mb-0 w-full"
          isStreaming={isReasoningStreaming}
          translate="no"
        >
          <ReasoningTrigger />
          {reasoningText && (
            <ReasoningContent className="mt-2 text-xs leading-normal *:space-y-1">
              {reasoningText}
            </ReasoningContent>
          )}
        </Reasoning>
      )}

      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return (
              <Fragment key={`${message.id}-${index}`}>
                <Message
                  from={message.role}
                  className={cn(
                    "notranslate max-w-[90%]",
                    isAssistant && "max-w-full",
                  )}
                  translate="no"
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
          case "reasoning":
            return null;
          default:
            if (isStaticToolUIPart(part)) {
              return (
                <Tool
                  key={`${message.id}-part-${index}`}
                  className="notranslate mb-0"
                  translate="no"
                >
                  <ToolHeader
                    type={part.type}
                    state={part.state}
                    className="truncate"
                  />
                  <ToolContent>
                    <ToolInput input={part.input} />
                    <ToolOutput
                      output={getToolOutputPreview(part)}
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
