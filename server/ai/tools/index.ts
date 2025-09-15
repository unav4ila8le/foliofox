import { tool } from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "./portfolio-snapshot";
import { getTransactions } from "./transactions";
import { getRecords } from "./records";
import { getNetWorthHistory } from "./net-worth-history";
import { getNetWorthChange } from "./net-worth-change";
import { getProjectedIncome } from "./projected-income";

export const aiTools = {
  getPortfolioSnapshot: tool({
    description:
      "Get current portfolio overview including net worth, asset allocation, and all holdings. Returns: summary, net worth value, holdings count, asset categories with percentages, and detailed holding information with values converted to base currency.",
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
      "Get transactions history with optional filtering. Returns: transaction list with type, date, quantity, unit value, holding details, and metadata. Supports filtering by holding, date range, and archived status.",
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
      "Get historical records (quantity and unit value snapshots) for a specific holding. Returns: record list with date, quantity, unit value, total value, cost basis, and currency. Useful for analyzing holding performance over time.",
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
      "Get net worth history over time to analyze financial trends. Returns: chronological list of net worth values with dates, total data points, and period information. Shows portfolio growth/decline patterns.",
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

  getNetWorthChange: tool({
    description:
      "Get net worth change over a specified period to analyze portfolio performance. Returns: current vs previous values, absolute change amount, percentage change, and direction (positive/negative). Shows portfolio growth rate and momentum.",
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
          "Number of weeks to compare back (default: 24 weeks = ~6 months)",
        ),
    }),
    execute: async (args) => {
      return getNetWorthChange(args);
    },
  }),

  getProjectedIncome: tool({
    description:
      "Get projected dividend income over future months to analyze passive income potential. Returns: monthly income projections with dates, total projected income, dividend-paying holdings count, and success status. Useful for income planning and dividend strategy analysis.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      monthsAhead: z
        .number()
        .optional()
        .describe(
          "Number of months to project ahead (default: 12 months = 1 year)",
        ),
    }),
    execute: async (args) => {
      return getProjectedIncome(args);
    },
  }),
};
