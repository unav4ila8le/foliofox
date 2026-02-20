import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  CHAT_FILE_ACCEPT_ATTRIBUTE,
  MAX_CHAT_FILES_PER_MESSAGE,
  MAX_CHAT_FILE_SIZE_BYTES,
} from "@/lib/ai/chat-file-upload-guardrails";
import { cn } from "@/lib/utils";

import type { ChatComposerProps } from "./types";

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
          <PromptInputAttachments className="p-2">
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
