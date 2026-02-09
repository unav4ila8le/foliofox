import { aiModel, chatModelId } from "@/server/ai/provider";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";

import { fetchProfile } from "@/server/profile/actions";
import { createSystemPrompt, type Mode } from "@/server/ai/system-prompt";
import { aiTools } from "@/server/ai/tools";
import {
  AIChatPersistenceError,
  prepareConversationForRegenerate,
  persistConversationFromMessages,
  persistAssistantMessage,
} from "@/server/ai/conversations/persist";
import { buildGuardrailedModelContext } from "@/server/ai/chat-guardrails";
import {
  AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE,
  AI_CHAT_ERROR_CODES,
} from "@/lib/ai/chat-errors";

// Allow streaming responses up to 120 seconds (reasoning models need more time)
export const maxDuration = 120;

const chatRequestSchema = z.looseObject({
  messages: z.array(
    z.looseObject({
      id: z.string().optional(),
      role: z.enum(["system", "user", "assistant", "tool"]),
      parts: z.array(z.any()),
    }),
  ),
  trigger: z.string().optional(),
  messageId: z.string().optional().nullable(),
});

const validModes = new Set<Mode>(["educational", "advisory", "unhinged"]);

export async function POST(req: Request) {
  // 1. Validate request payload early to avoid malformed chat writes.
  const body = await req.json().catch(() => null);
  const parsedRequest = chatRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return new Response("Invalid chat request payload", { status: 400 });
  }

  const messages = parsedRequest.data.messages as UIMessage[];
  const trigger =
    parsedRequest.data.trigger === "regenerate-message"
      ? "regenerate-message"
      : "submit-message";
  // Acknowledged in schema; reserved for future message-level operations.
  void parsedRequest.data.messageId;

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

  // 3. Persist user-side conversation state before model execution.
  //    Regenerate updates only the assistant side of history.
  if (conversationId) {
    try {
      if (trigger === "submit-message") {
        await persistConversationFromMessages({
          conversationId,
          messages,
        });
      } else {
        await prepareConversationForRegenerate({ conversationId });
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
  const system = createSystemPrompt({ mode, aiTools });
  const firstAssistantTurn = !messages.some((m) => m.role === "assistant");

  const result = streamText({
    model: aiModel(chatModelId),
    messages: await convertToModelMessages(guardrailedContextMessages),
    tools: aiTools,
    system,
    maxOutputTokens: 16000,
    stopWhen: stepCountIs(24),
    providerOptions: {
      openai: {
        reasoningSummary: "auto",
      },
    },

    // Force portfolio overview on very first assistant step
    prepareStep: async ({ stepNumber }) => {
      if (firstAssistantTurn && stepNumber === 0) {
        return {
          toolChoice: { type: "tool", toolName: "getPortfolioOverview" },
          // Limit available tools to avoid accidental picks or schema failures
          activeTools: ["getPortfolioOverview"],
        };
      }
      // Otherwise, default behavior (no forced tools)
      return {};
    },

    onError: (err) => {
      console.error("AI chat error:", err);
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onFinish: async ({ responseMessage, isAborted }) => {
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
        });
      } catch (error) {
        console.error("AI chat assistant persistence error:", error);
      }
    },
  });
}
