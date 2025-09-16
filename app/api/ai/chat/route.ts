import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";

import { buildSystemPrompt, type Mode } from "@/server/ai/system-prompt";
import { aiTools } from "@/server/ai/tools";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const mode =
    (req.headers.get("x-ff-mode")?.toLowerCase() as Mode) ?? "advisory";

  const system = buildSystemPrompt({ mode });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: aiTools,
    system,
  });

  return result.toUIMessageStreamResponse();
}
