import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import {
  CHAT_FILE_ACCEPT_ATTRIBUTE,
  MAX_CHAT_FILES_PER_MESSAGE,
  MAX_CHAT_FILE_SIZE_BYTES,
} from "@/lib/ai/chat-file-upload-guardrails";
import { cn } from "@/lib/utils";

import type { ChatComposerProps } from "./types";

function ChatComposerAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments className="p-2" variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          key={attachment.id}
          data={attachment}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

export function ChatComposer({
  status,
  mode,
  isAIEnabled,
  showProactiveCapAlert,
  controller,
  textareaRef,
  onSubmit,
  onModeChange,
  onStop,
  onInputError,
}: ChatComposerProps) {
  const isChatInputDisabled = !isAIEnabled || showProactiveCapAlert;
  const trimmedTextLength = controller.textInput.value.trim().length;
  const hasAttachments = controller.attachments.files.length > 0;

  return (
    <div
      className={cn(
        "px-4",
        isChatInputDisabled && "pointer-events-none opacity-50",
      )}
    >
      <PromptInput
        onSubmit={onSubmit}
        onError={onInputError}
        accept={CHAT_FILE_ACCEPT_ATTRIBUTE}
        maxFiles={MAX_CHAT_FILES_PER_MESSAGE}
        maxFileSize={MAX_CHAT_FILE_SIZE_BYTES}
        className="bg-background rounded-md"
      >
        <PromptInputHeader className="p-0">
          <ChatComposerAttachments />
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
            <SpeechInput
              aria-label="Dictate message"
              size="icon-sm"
              variant="outline"
              type="button"
              onTranscriptionChange={(text) => {
                controller.textInput.setInput(
                  [controller.textInput.value.trim(), text.trim()]
                    .filter(Boolean)
                    .join(" "),
                );
              }}
            />
            <PromptInputSelect
              value={mode}
              onValueChange={(value) => onModeChange(value as typeof mode)}
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
              isChatInputDisabled
                ? true
                : status === "streaming"
                  ? false
                  : trimmedTextLength < 2 && !hasAttachments
            }
            onClick={(event) => {
              if (status === "streaming") {
                event.preventDefault();
                onStop();
              }
            }}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
