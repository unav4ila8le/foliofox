import { tool } from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "./portfolio-snapshot";
import { getTransactions } from "./transactions";
import { getRecords } from "./records";
import { getNetWorthHistory } from "./net-worth-history";

export const aiTools = {
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
      holdingId: z.string().describe("Required holding ID to get records for"),
      startDate: z.string().optional().describe("YYYY-MM-DD format"),
      endDate: z.string().optional().describe("YYYY-MM-DD format"),
    }),
    execute: async (args) => {
      return getRecords(args);
    },
  }),

  getNetWorthHistory: tool({
    description:
      "Get net worth history over time to analyze the user's financial trends and patterns",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      weeksBack: z
        .number()
        .optional()
        .describe(
          "Number of weeks to look back (default: 24 weeks = ~6 months)",
        ),
    }),
    execute: async (args) => {
      return getNetWorthHistory(args);
    },
  }),
};
