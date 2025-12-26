import { tool } from "ai";
import { z } from "zod";

// Portfolio tracking
import { getPortfolioOverview } from "./portfolio-overview";
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
import { getDividendYield } from "./dividend-yield";
import { getHistoricalQuotes } from "./historical-quotes";
import { searchSymbols } from "./search-symbols";
import { getNews } from "./news";

// Financial scenarios
import { getFinancialScenarios } from "./financial-scenarios";

export const aiTools = {
  getPortfolioOverview: tool({
    description:
      "Get a comprehensive portfolio overview including the user's financial profile, net worth, asset allocation, and all positions at any given date. Returns: summary, financial profile, net worth value, positions count, asset categories with percentages, and detailed position information with values converted to base currency. Use this for both current and historical portfolio snapshots - for deeper analysis also use the other specialized tools.",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      date: z
        .string()
        .nullable()
        .describe(
          "Date for historical analysis in YYYY-MM-DD format (e.g., 2024-07-22). Leave empty to use the current date.",
        ),
    }),
    execute: async (args) => {
      return getPortfolioOverview(args);
    },
  }),

  getPositions: tool({
    description:
      "Get raw positions in original currencies (no FX conversion). Optionally filter by position IDs. Uses market prices as-of the given date (defaults to today) for market-backed positions (e.g., securities, domains, etc.).",
    inputSchema: z.object({
      positionIds: z.array(z.string()).nullable(),
      date: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getPositions(args),
  }),

  getPortfolioRecords: tool({
    description:
      "Get portfolio records history with optional filtering. Returns: record list with type, date, quantity, unit value, position details, and metadata. Supports filtering by position, date range, and archived status.",
    inputSchema: z.object({
      positionId: z.string().nullable(),
      startDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      includeArchived: z
        .boolean()
        .nullable()
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
      startDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      daysBack: z
        .number()
        .nullable()
        .describe(
          "Number of days to look back (default: 180 days = ~6 months)",
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      daysBack: z
        .number()
        .nullable()
        .describe(
          "Number of days to compare back (default: 180 days ≈ 6 months)",
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      monthsAhead: z
        .number()
        .nullable()
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      positionIds: z
        .array(z.string())
        .nullable()
        .describe(
          "Specific position IDs to analyze (assets only). If omitted, analyzes all assets. Get IDs via getPortfolioOverview or getPositions.",
        ),
      startDate: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to 180 days ago)"),
      endDate: z
        .string()
        .nullable()
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP, etc.). Leave empty to use the user's preferred currency.",
        ),
      startDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      limit: z.number().nullable().describe("Optional, defaults to 5"),
    }),
    execute: async (args) => getTopMovers(args),
  }),

  getAllocationDrift: tool({
    description:
      "Compare current asset allocation vs a past date, showing percentage drift by category (rebalance insights).",
    inputSchema: z.object({
      baseCurrency: z
        .string()
        .nullable()
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
        .nullable()
        .describe(
          "Currency code for analysis (e.g., USD, EUR, GBP). Leave empty to use the user's preferred currency.",
        ),
      date: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getCurrencyExposure(args),
  }),

  getDividendYield: tool({
    description:
      "Get the latest dividend yield, last dividend amount, and payout cadence for a symbol. Use searchSymbols first if you need to confirm the Yahoo Finance symbol ticker. Set includeHistory to true when you want the recent dividend events list for added context.",
    inputSchema: z.object({
      symbolLookup: z
        .string()
        .describe(
          "Symbol lookup value (ticker, alias, or canonical UUID). Use searchSymbols first if you're unsure about the ticker.",
        ),
      includeHistory: z
        .boolean()
        .nullable()
        .describe(
          "Set to true to include up to the 12 most recent dividend events.",
        ),
    }),
    execute: async (args) => getDividendYield(args),
  }),

  getHistoricalQuotes: tool({
    description:
      "Retrieve daily historical prices for a symbol across a limited date range (≤365 days). Useful when the user asks for chart-ready data or wants to compare performance outside stored portfolio records. If you're unsure about the Yahoo Finance ticker symbol, call searchSymbols first to confirm the correct symbol before invoking this tool.",
    inputSchema: z.object({
      symbolLookup: z
        .string()
        .describe(
          "Symbol lookup value (ticker, alias, or canonical UUID). Use searchSymbols first if you're unsure about the ticker.",
        ),
      startDate: z
        .string()
        .nullable()
        .describe(
          "Inclusive start date in YYYY-MM-DD format (optional, defaults to 30 days before end date).",
        ),
      endDate: z
        .string()
        .nullable()
        .describe(
          "Inclusive end date in YYYY-MM-DD format (optional, defaults to today).",
        ),
    }),
    execute: async (args) => getHistoricalQuotes(args),
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
        .nullable()
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
      symbolLookups: z
        .array(z.string())
        .nullable()
        .describe(
          "Array of symbol lookup strings (tickers, aliases, or UUIDs). If omitted, returns news for the user's entire portfolio.",
        ),
      limit: z
        .number()
        .nullable()
        .describe(
          "Maximum number of articles to return (default: 10). Limit is distributed across symbols.",
        ),
    }),
    execute: async (args) => getNews(args),
  }),

  getFinancialScenarios: tool({
    description:
      "Get the user's financial scenario (scenario planning) with income/expense events and optional simulation. Returns: scenario name, initial balance, events with conditions and recurrence, and optionally runs a forward simulation showing projected balances over time. Useful for analyzing financial plans, projections, and 'what-if' scenarios. Use this when the user asks about their scenario plan, future projections, or wants advice on their planned income/expense events.",
    inputSchema: z.object({
      runSimulation: z
        .boolean()
        .nullable()
        .describe(
          "Run a forward simulation of the scenario (default: true). Set to false to just retrieve event definitions.",
        ),
      simulationYears: z
        .number()
        .nullable()
        .describe(
          "Number of years to simulate ahead (default: 10, max: 30). Only used if runSimulation is true.",
        ),
    }),
    execute: async (args) => getFinancialScenarios(args),
  }),
};
