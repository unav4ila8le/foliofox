import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";

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
  const model = "gpt-4o-mini";
  const mode =
    (req.headers.get("x-ff-mode")?.toLowerCase() as Mode) ?? "advisory";
  const conversationId = req.headers.get("x-ff-conversation-id") ?? undefined;

  if (conversationId) {
    // Non-blocking; don't fail the request if persistence errors
    persistConversationFromMessages({ conversationId, messages }).catch(
      () => {},
    );
  }

  const system = createSystemPrompt({ mode, aiTools });

  const firstAssistantTurn = !messages.some((m) => m.role === "assistant");

  const result = streamText({
    model: openai(model),
    messages: convertToModelMessages(messages),
    tools: aiTools,
    system,
    stopWhen: stepCountIs(24),

    // Force portfolio snapshot on very first assistant step
    prepareStep: async ({ stepNumber }) => {
      if (firstAssistantTurn && stepNumber === 0) {
        return {
          toolChoice: { type: "tool", toolName: "getPortfolioSnapshot" },
          // Limit available tools to avoid accidental picks or schema failures
          activeTools: ["getPortfolioSnapshot"],
        };
      }
      // Otherwise, default behavior (no forced tools)
      return {};
    },

    onError: (err) => {
      console.error("AI chat error:", err);
    },

    onFinish: async ({ text, usage }) => {
      if (!conversationId || !text) return;
      await persistAssistantMessage({
        conversationId,
        content: text,
        model,
        usageTokens: usage?.totalTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
