import { openai } from "@ai-sdk/openai";
import { streamText, tool, UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "@/server/ai/tools/portfolio";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    tools: {
      getPortfolioSnapshot: tool({
        description:
          "Get current portfolio overview including net worth, asset allocation, and all holdings",
        inputSchema: z.object({
          baseCurrency: z.string().optional(),
        }),
        execute: ({ baseCurrency }) => getPortfolioSnapshot({ baseCurrency }),
      }),
    },
    system: `You are the Foliofox AI assistant, a financial advisor for personal portfolio insights.

ROLE: Help users understand their portfolio performance, allocation, and provide concrete financial planning and guidance.

CAPABILITIES:
- Analyze portfolio composition and performance using available tools
- Explain portfolio allocation and suggest improvements  
- Answer questions about holdings and their performance
- Provide educational context about investments
- Provide actionable financial planning and guidance

GUIDELINES:
- Always use tools to get current data before providing analysis
- Be specific about which data you're referencing (e.g., "Based on your current holdings...")
- Explain financial concepts clearly for beginners
- Include relevant risks and considerations
- Keep responses concise but comprehensive
- When discussing money, always specify the currency

BEHAVIOR:
- When users ask about their portfolio, use getPortfolioSnapshot to get current data
- Default to USD for analysis unless user specifies a different currency
- Focus on actionable insights rather than just data presentation`,
  });

  return result.toUIMessageStreamResponse();
}
