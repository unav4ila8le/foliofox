import { aiModel, chatModelId } from "@/server/ai/provider";
import {
  streamText,
  type FileUIPart,
  type UIMessage,
  type InferUITools,
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { fetchProfile } from "@/server/profile/actions";
import { createSystemPrompt, type Mode } from "@/server/ai/system-prompt";
import { aiTools } from "@/server/ai/tools";
import { createToolCallGuard } from "@/server/ai/tooling/tool-call-guard";
import {
  AIChatPersistenceError,
  persistConversationFromMessages,
  persistAssistantMessage,
} from "@/server/ai/conversations/persist";
import { buildGuardrailedModelContext } from "@/server/ai/chat-guardrails";
import {
  AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
  AI_CHAT_ERROR_CODES,
} from "@/lib/ai/chat-errors";
import { type AIAssistantPromptSource } from "@/server/ai/telemetry/constants";
import { trackAssistantTurn } from "@/server/ai/telemetry/track-assistant-turn";
import { resolveTodayDateKey } from "@/lib/date/date-utils";
import {
  CHAT_FILE_ALLOWED_TYPES_TEXT,
  MAX_CHAT_FILE_SIZE_BYTES,
  MAX_CHAT_FILE_SIZE_MB,
  MAX_CHAT_FILES_PER_MESSAGE,
  estimateDataUrlBytes,
  isAllowedChatFileMediaType,
} from "@/lib/ai/chat-file-upload-guardrails";

// Allow streaming responses up to 160 seconds (reasoning models need more time)
export const maxDuration = 160;
const MAX_TOOL_CALLS_PER_TURN = 8;
const MAX_CALLS_PER_TOOL_PER_TURN = 4;
const TOOL_BUDGET_FINAL_SYNTHESIS_INSTRUCTION =
  "Tool-call budget is exhausted for this turn. Do not emit tool-call syntax, JSON function-call payloads, or pseudo tool invocations. Use already retrieved tool results to provide the best direct answer now. If critical data is still missing, ask one concise clarification question.";

const chatRequestSchema = z.looseObject({
  messages: z.unknown(),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
  promptSource: z.string().optional(),
});

const validModes = new Set<Mode>(["educational", "advisory", "unhinged"]);
type ChatUIMessage = UIMessage<unknown, never, InferUITools<typeof aiTools>>;

// Resolve the prompt source from the request payload
function resolvePromptSource(
  promptSource: string | undefined,
): AIAssistantPromptSource {
  return promptSource === "suggestion" ? "suggestion" : "typed";
}

// Get the media type from the data URL
function getDataUrlMediaType(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1]?.trim().toLowerCase() || null;
}

// Validate the latest user file parts
function validateLatestUserFileParts(messages: ChatUIMessage[]): string | null {
  const latestUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!latestUserMessage) {
    return null;
  }

  const fileParts = latestUserMessage.parts.filter(
    (part): part is FileUIPart => part.type === "file",
  );
  if (fileParts.length === 0) {
    return null;
  }

  if (fileParts.length > MAX_CHAT_FILES_PER_MESSAGE) {
    return `You can upload up to ${MAX_CHAT_FILES_PER_MESSAGE} files per message.`;
  }

  for (let index = 0; index < fileParts.length; index += 1) {
    const filePart = fileParts[index];
    if (!filePart) {
      continue;
    }

    if (!filePart.url.startsWith("data:")) {
      return "Invalid file payload format.";
    }

    const dataUrlMediaType = getDataUrlMediaType(filePart.url);
    if (!dataUrlMediaType) {
      return "Invalid file payload format.";
    }

    if (!isAllowedChatFileMediaType(dataUrlMediaType)) {
      return `One or more files have an unsupported type. Allowed file types: ${CHAT_FILE_ALLOWED_TYPES_TEXT}.`;
    }

    const declaredMediaType = (filePart.mediaType ?? "").trim().toLowerCase();
    if (declaredMediaType && declaredMediaType !== dataUrlMediaType) {
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

export async function POST(req: Request) {
  // 1. Validate request payload early to avoid malformed chat writes.
  const body = await req.json().catch(() => null);
  const parsedRequest = chatRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return new Response("Invalid chat request payload", { status: 400 });
  }

  // Validate incoming UI messages against AI SDK structures + registered tools.
  const validatedMessages = await safeValidateUIMessages<ChatUIMessage>({
    messages: parsedRequest.data.messages,
    tools: aiTools,
  });
  if (!validatedMessages.success) {
    return new Response("Invalid chat message payload", { status: 400 });
  }

  const messages = validatedMessages.data;
  const fileValidationError = validateLatestUserFileParts(messages);
  if (fileValidationError) {
    return new Response(fileValidationError, { status: 400 });
  }

  const trigger =
    parsedRequest.data.trigger === "regenerate-message"
      ? "regenerate-message"
      : "submit-message";
  const regenerateTargetMessageId =
    trigger === "regenerate-message"
      ? parsedRequest.data.messageId?.trim() || undefined
      : undefined;
  const promptSource = resolvePromptSource(parsedRequest.data.promptSource);

  const modeHeader = req.headers.get("x-ff-mode")?.toLowerCase();
  const mode: Mode =
    modeHeader && validModes.has(modeHeader as Mode)
      ? (modeHeader as Mode)
      : "advisory";

  const conversationIdHeader = req.headers.get("x-ff-conversation-id");
  const conversationIdParse = z.uuid().safeParse(conversationIdHeader);
  if (conversationIdHeader && !conversationIdParse.success) {
    return new Response("Invalid conversation id", { status: 400 });
  }
  const conversationId = conversationIdParse.success
    ? conversationIdParse.data
    : undefined;

  // 2. Enforce consent at the API boundary (client state is not trusted).
  const { profile } = await fetchProfile();
  if (!profile.data_sharing_consent) {
    return new Response("AI data sharing consent required", { status: 403 });
  }
  const currentDateKey = resolveTodayDateKey(profile.time_zone);

  // 3. Persist only submit user turns before model execution.
  //    Regenerate replacement happens after successful assistant persistence.
  // TODO: Avoid orphaned user turns when model streaming fails after this write
  // by introducing a failed-state marker or atomic user+assistant persistence flow.
  if (conversationId) {
    try {
      if (trigger === "submit-message") {
        await persistConversationFromMessages({
          conversationId,
          messages,
        });
      }
    } catch (error) {
      if (
        error instanceof AIChatPersistenceError &&
        error.code === AI_CHAT_ERROR_CODES.conversationCapReached
      ) {
        return new Response(AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE, {
          status: 409,
          headers: {
            "x-ff-error-code": AI_CHAT_ERROR_CODES.conversationCapReached,
          },
        });
      }

      console.error("AI chat persistence error:", error);
      return new Response("Failed to persist conversation", { status: 500 });
    }
  }

  // 4. Bound model context size to keep latency/cost predictable.
  const guardrailedContextMessages = buildGuardrailedModelContext(messages);
  const system = createSystemPrompt({
    mode,
    aiTools,
    currentDateKey,
  });
  const firstAssistantTurn = !messages.some((m) => m.role === "assistant");
  const { guardedTools, guardState } = createToolCallGuard(aiTools, {
    maxTotalCallsPerTurn: MAX_TOOL_CALLS_PER_TURN,
    maxCallsPerToolPerTurn: MAX_CALLS_PER_TOOL_PER_TURN,
    enableExactInputDeduplication: true,
  });

  const result = streamText({
    model: aiModel(chatModelId),
    messages: await convertToModelMessages(guardrailedContextMessages),
    tools: guardedTools,
    system,
    maxOutputTokens: 8000,
    stopWhen: [stepCountIs(24)],
    providerOptions: {
      openai: {
        reasoningSummary: "auto",
        reasoningEffort: "medium",
      },
    },

    // Force portfolio overview on very first assistant step
    prepareStep: async ({ stepNumber }) => {
      const availableTools = (
        Object.keys(aiTools) as Array<keyof typeof aiTools>
      ).filter(
        (toolName) =>
          guardState.getCallsForTool(String(toolName)) <
          MAX_CALLS_PER_TOOL_PER_TURN,
      );

      if (
        guardState.getTotalCalls() >= MAX_TOOL_CALLS_PER_TURN ||
        availableTools.length === 0
      ) {
        // Block additional tool calls, but still allow a text-only synthesis step.
        return {
          activeTools: [],
          system: `${system}\n\n${TOOL_BUDGET_FINAL_SYNTHESIS_INSTRUCTION}`,
        };
      }

      if (firstAssistantTurn && stepNumber === 0) {
        return {
          toolChoice: { type: "tool", toolName: "getPortfolioOverview" },
          // Limit available tools to avoid accidental picks or schema failures
          activeTools: ["getPortfolioOverview"],
        };
      }
      // Otherwise, expose tools that still have remaining per-turn budget.
      return { activeTools: availableTools };
    },

    onError: (err) => {
      console.error("AI chat error:", err);
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => uuidv4(),
    sendReasoning: true,
    sendSources: true,
    onFinish: async ({ responseMessage, isAborted, finishReason }) => {
      // 5. Persist only the assistant response that just streamed.
      if (!conversationId || isAborted) {
        return;
      }

      try {
        const tokens = await result.totalUsage;
        await persistAssistantMessage({
          conversationId,
          message: responseMessage,
          model: chatModelId,
          usageTokens: tokens.totalTokens,
          replaceLatestAssistantForRegenerate: trigger === "regenerate-message",
          targetAssistantMessageIdForRegenerate: regenerateTargetMessageId,
        });
      } catch (error) {
        console.error("AI chat assistant persistence error:", error);
        return;
      }

      try {
        await trackAssistantTurn({
          conversationId,
          assistantMessageId: responseMessage.id,
          model: chatModelId,
          promptSource,
          message: responseMessage,
          finishReason,
        });
      } catch (error) {
        console.error("AI chat telemetry error:", error);
      }
    },
  });
}
