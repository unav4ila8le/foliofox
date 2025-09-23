import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";

import { createSystemPrompt, type Mode } from "@/server/ai/system-prompt";
import { aiTools } from "@/server/ai/tools";
import {
  persistConversationFromMessages,
  persistAssistantMessage,
} from "@/server/ai/conversations/persist";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const model = "gpt-4o-mini";
  const mode =
    (req.headers.get("x-ff-mode")?.toLowerCase() as Mode) ?? "advisory";
  const conversationId = req.headers.get("x-ff-conversation-id") ?? undefined;

  if (conversationId) {
    // Non-blocking; don’t fail the request if persistence errors
    persistConversationFromMessages({ conversationId, messages }).catch(
      () => {},
    );
  }

  const system = createSystemPrompt({ mode, aiTools });

  const result = streamText({
    model: openai(model),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(18),
    tools: aiTools,
    system,
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
