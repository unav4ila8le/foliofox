import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "@/server/ai/tools/portfolio-snapshot";
import { getTransactions } from "@/server/ai/tools/transactions";
import { getRecords } from "@/server/ai/tools/records";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: {
      getPortfolioSnapshot: tool({
        description:
          "Get current portfolio overview including net worth, asset allocation, and all holdings",
        inputSchema: z.object({
          baseCurrency: z
            .string()
            .optional()
            .describe(
              "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
            ),
          date: z
            .string()
            .optional()
            .describe(
              "Date for historical analysis in YYYY-MM-DD format (e.g., 2024-07-22). Leave empty to use the current date.",
            ),
        }),
        execute: async (args) => {
          return getPortfolioSnapshot(args);
        },
      }),
      getTransactions: tool({
        description:
          "Get transactions within optional date range and/or holding filtering",
        inputSchema: z.object({
          holdingId: z.string().optional(),
          startDate: z.string().optional().describe("YYYY-MM-DD format"),
          endDate: z.string().optional().describe("YYYY-MM-DD format"),
          includeArchived: z
            .boolean()
            .optional()
            .describe("Include transactions from archived holdings"),
        }),
        execute: async (args) => {
          return getTransactions(args);
        },
      }),
      getRecords: tool({
        description:
          "Get records (quantity and unit value snapshots) for a specific holding with optional date range filtering",
        inputSchema: z.object({
          holdingId: z
            .string()
            .describe("Required holding ID to get records for"),
          startDate: z.string().optional().describe("YYYY-MM-DD format"),
          endDate: z.string().optional().describe("YYYY-MM-DD format"),
        }),
        execute: async (args) => {
          return getRecords(args);
        },
      }),
    },
    system: `You are the Foliofox AI assistant, a financial advisor for personal portfolio insights.

    Current date: ${new Date().toISOString().split("T")[0]} (use this for relative date calculations and tool inputs).

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
- Do not specify baseCurrency unless user explicitly requests a different currency - tools default to user's preferred currency
- Focus on actionable insights rather than just data presentation`,
  });

  return result.toUIMessageStreamResponse();
}
