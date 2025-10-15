import { tool } from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "./portfolio-snapshot";
import { getHoldings } from "./holdings";
import { getTransactions } from "./transactions";
import { getRecords } from "./records";
import { getNetWorthHistory } from "./net-worth-history";
import { getNetWorthChange } from "./net-worth-change";
import { getProjectedIncome } from "./projected-income";
import { getHoldingsPerformance } from "./holdings-performance";
import { getTopMovers } from "./top-movers";
import { getAllocationDrift } from "./allocation-drift";
import { getCurrencyExposure } from "./currency-exposure";
import { searchSymbols } from "./search-symbols";
import { getNews } from "./news";

export const aiTools = {
  getPortfolioSnapshot: tool({
    description:
      "Get a comprehensive portfolio overview including net worth, asset allocation, and all holdings at any given date. Returns: summary, net worth value, holdings count, asset categories with percentages, and detailed holding information with values converted to base currency. Use this for both current and historical portfolio snapshots - for deeper analysis also use the other specialized tools.",
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

  getHoldings: tool({
    description:
      "Get raw holdings in original currencies (no FX conversion). Optionally filter by holding IDs. Uses market prices as-of the given date (defaults to today) for symbol holdings.",
    inputSchema: z.object({
      holdingIds: z.array(z.string()).optional(),
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getHoldings(args),
  }),

  getTransactions: tool({
    description:
      "Get transactions history with optional filtering. Returns: transaction list with type, date, quantity, unit value, holding details, and metadata. Supports filtering by holding, date range, and archived status.",
    inputSchema: z.object({
      holdingId: z.string().optional(),
      startDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
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
      startDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
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

  getHoldingsPerformance: tool({
    description:
      "Analyze holding(s) performance over a period. Returns price return (market move), value change (includes flows), and current unrealized P/L vs cost basis. Can analyze single holding, multiple holdings, or entire portfolio.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      holdingIds: z
        .array(z.string())
        .optional()
        .describe(
          "Specific holding IDs to analyze. If omitted, analyzes all holdings.",
        ),
      startDate: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format (optional, defaults to 180 days ago)"),
      endDate: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getHoldingsPerformance(args),
  }),

  getTopMovers: tool({
    description:
      "Find top gainers and losers over a period. Returns ranked lists by percentage (market move) and absolute change (includes flows).",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      startDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().optional().describe("YYYY-MM-DD format (optional)"),
      limit: z.number().optional().describe("Optional, defaults to 5"),
    }),
    execute: async (args) => getTopMovers(args),
  }),

  getAllocationDrift: tool({
    description:
      "Compare current asset allocation vs a past date, showing percentage drift by category (rebalance insights).",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      compareToDate: z
        .string()
        .describe("Historical date to compare against (YYYY-MM-DD format)"),
    }),
    execute: async (args) => getAllocationDrift(args),
  }),

  getCurrencyExposure: tool({
    description:
      "Calculate portfolio currency exposure by original currency as-of a date. Returns per-currency local value, base-currency value, percentage weight, FX rate used, and holdings count.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .optional()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP). Leave empty to use the user's preferred currency.",
        ),
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getCurrencyExposure(args),
  }),

  searchSymbols: tool({
    description:
      "Find the correct Yahoo Finance symbol for a company name or validate a symbol. Returns: matching symbols with company names, exchanges, and types. Use this to convert company names to valid symbols before using them in other tools like getNews. Essential for ensuring symbols work correctly in the system.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Company name (e.g., 'Apple', 'Tesla') or symbol to validate (e.g., 'AAPL', 'TSLA').",
        ),
      limit: z
        .number()
        .optional()
        .describe(
          "Maximum number of symbols to return (default: 10, max: 20).",
        ),
    }),
    execute: async (args) => searchSymbols(args),
  }),

  getNews: tool({
    description:
      "Get news articles for specific symbols or user's portfolio. Returns: news articles with title, publisher, link, published date, and related symbols. If no symbols provided, returns news for user's entire portfolio. Useful for market analysis and staying informed about holdings.",
    inputSchema: z.object({
      symbolIds: z
        .array(z.string())
        .optional()
        .describe(
          "Array of symbol IDs to get news for (e.g., ['AAPL', 'MSFT']). If omitted, returns news for user's entire portfolio.",
        ),
      limit: z
        .number()
        .optional()
        .describe(
          "Maximum number of articles to return (default: 10). Limit is distributed across symbols.",
        ),
    }),
    execute: async (args) => getNews(args),
  }),
};
