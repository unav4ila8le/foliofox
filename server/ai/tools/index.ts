import { tool } from "ai";
import { z } from "zod";

import { getPortfolioSnapshot } from "./portfolio-snapshot";
import { getPositions } from "./positions";
import { getPortfolioRecords } from "./portfolio-records";
import { getPositionSnapshots } from "./position-snapshots";
import { getNetWorthHistory } from "./net-worth-history";
import { getNetWorthChange } from "./net-worth-change";
import { getProjectedIncome } from "./projected-income";
import { getAssetsPerformance } from "./assets-performance";
import { getTopMovers } from "./top-movers";
import { getAllocationDrift } from "./allocation-drift";
import { getCurrencyExposure } from "./currency-exposure";
import { searchSymbols } from "./search-symbols";
import { getNews } from "./news";

export const aiTools = {
  getPortfolioSnapshot: tool({
    description:
      "Get a comprehensive portfolio overview including net worth, asset allocation, and all positions at any given date. Returns: summary, net worth value, positions count, asset categories with percentages, and detailed position information with values converted to base currency. Use this for both current and historical portfolio snapshots - for deeper analysis also use the other specialized tools.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      date: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Date for historical analysis in YYYY-MM-DD format (e.g., 2024-07-22). Leave empty to use the current date.",
        ),
    }),
    execute: async (args) => {
      return getPortfolioSnapshot(args);
    },
  }),

  getPositions: tool({
    description:
      "Get raw positions in original currencies (no FX conversion). Optionally filter by position IDs. Uses market prices as-of the given date (defaults to today) for market-backed positions (e.g., securities, domains, etc.).",
    inputSchema: z.object({
      positionIds: z
        .array(z.string())
        .nullish()
        .transform((v) => v ?? undefined),
      date: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getPositions(args),
  }),

  getPortfolioRecords: tool({
    description:
      "Get portfolio records history with optional filtering. Returns: record list with type, date, quantity, unit value, position details, and metadata. Supports filtering by position, date range, and archived status.",
    inputSchema: z.object({
      positionId: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined),
      startDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
      endDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
      includeArchived: z
        .boolean()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("Include records from archived positions"),
    }),
    execute: async (args) => {
      return getPortfolioRecords(args);
    },
  }),

  getPositionSnapshots: tool({
    description:
      "Get historical snapshots (quantity and unit value) for a specific position. Returns: snapshot list with date, quantity, unit value, total value, and currency. Useful for analyzing position performance over time.",
    inputSchema: z.object({
      positionId: z
        .string()
        .describe("Required position ID to get snapshots for"),
      startDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
      endDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
    }),
    execute: async (args) => {
      return getPositionSnapshots(args);
    },
  }),

  getNetWorthHistory: tool({
    description:
      "Get net worth history over time to analyze financial trends. Returns: chronological list of net worth values with dates, total data points, and period information. Shows portfolio growth/decline patterns.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      weeksBack: z
        .number()
        .nullish()
        .transform((v) => v ?? undefined)
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
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      weeksBack: z
        .number()
        .nullish()
        .transform((v) => v ?? undefined)
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
      "Get projected dividend income over future months to analyze passive income potential. Returns: monthly income projections with dates, total projected income, dividend-paying positions count, and success status. Useful for income planning and dividend strategy analysis.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      monthsAhead: z
        .number()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Number of months to project ahead (default: 12 months = 1 year)",
        ),
    }),
    execute: async (args) => {
      return getProjectedIncome(args);
    },
  }),

  getAssetsPerformance: tool({
    description:
      "Analyze asset(s) performance over a period. Returns price return (market move), value change (includes flows), and current unrealized P/L vs cost basis. Can analyze single asset, multiple assets, or entire portfolio.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      positionIds: z
        .array(z.string())
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Specific position IDs to analyze (assets only). If omitted, analyzes all assets. Get IDs via getPortfolioSnapshot or getPositions.",
        ),
      startDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional, defaults to 180 days ago)"),
      endDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getAssetsPerformance(args),
  }),

  getTopMovers: tool({
    description:
      "Find top gainers and losers over a period. Returns ranked lists by percentage (market move) and absolute change (includes flows).",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      startDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
      endDate: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("YYYY-MM-DD format (optional)"),
      limit: z
        .number()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe("Optional, defaults to 5"),
    }),
    execute: async (args) => getTopMovers(args),
  }),

  getAllocationDrift: tool({
    description:
      "Compare current asset allocation vs a past date, showing percentage drift by category (rebalance insights).",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
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
      "Calculate portfolio currency exposure by original currency as-of a date. Returns per-currency local value, base-currency value, percentage weight, FX rate used, and positions count.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP). Leave empty to use the user's preferred currency.",
        ),
      date: z
        .string()
        .nullish()
        .transform((v) => v ?? undefined)
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
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Maximum number of symbols to return (default: 10, max: 20).",
        ),
    }),
    execute: async (args) => searchSymbols(args),
  }),

  getNews: tool({
    description:
      "Get news articles for specific symbols or user's portfolio. Returns: news articles with title, publisher, link, published date, and related symbols. If no symbols provided, returns news for user's entire portfolio. Useful for market analysis and staying informed about user's positions.",
    inputSchema: z.object({
      symbolIds: z
        .array(z.string())
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Array of symbol IDs to get news for (e.g., ['AAPL', 'MSFT']). If omitted, returns news for user's entire portfolio.",
        ),
      limit: z
        .number()
        .nullish()
        .transform((v) => v ?? undefined)
        .describe(
          "Maximum number of articles to return (default: 10). Limit is distributed across symbols.",
        ),
    }),
    execute: async (args) => getNews(args),
  }),
};
