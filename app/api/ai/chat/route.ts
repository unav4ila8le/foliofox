import { aiModel, chatModelId } from "@/server/ai/provider";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";

import { fetchProfile } from "@/server/profile/actions";
import { createSystemPrompt, type Mode } from "@/server/ai/system-prompt";
import { aiTools } from "@/server/ai/tools";
import {
  persistConversationFromMessages,
  persistAssistantMessage,
} from "@/server/ai/conversations/persist";

// Allow streaming responses up to 45 seconds
export const maxDuration = 45;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const mode =
    (req.headers.get("x-ff-mode")?.toLowerCase() as Mode) ?? "advisory";
  const conversationId = req.headers.get("x-ff-conversation-id") ?? undefined;

  const { profile } = await fetchProfile();
  if (!profile.data_sharing_consent) {
    return new Response("AI data sharing consent required", { status: 403 });
  }

  if (conversationId) {
    // Non-blocking; don't fail the request if persistence errors
    persistConversationFromMessages({ conversationId, messages }).catch(
      () => {},
    );
  }

  const system = createSystemPrompt({ mode, aiTools });

  const firstAssistantTurn = !messages.some((m) => m.role === "assistant");

  const result = streamText({
    model: aiModel(chatModelId),
    messages: convertToModelMessages(messages),
    tools: aiTools,
    system,
    stopWhen: stepCountIs(24),

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
    onFinish: async ({ messages }) => {
      if (conversationId && messages.length > 0) {
        const tokens = await result.totalUsage;

        await persistAssistantMessage({
          conversationId,
          messages,
          model: chatModelId,
          usageTokens: tokens.totalTokens,
        });
      }
    },
  });
}
