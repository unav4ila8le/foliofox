import { z } from "zod";
import { NET_WORTH_MODES } from "@/server/analysis/net-worth/types";
import { routedTool } from "@/server/ai/tooling/routed-tool";

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
import {
  getHistoricalQuotes,
  getHistoricalQuotesBatch,
} from "./historical-quotes";
import { searchSymbols } from "./search-symbols";
import { getNews } from "./news";
import { getProductReference } from "./product-reference";

// Financial scenarios
import { getFinancialScenarios } from "./financial-scenarios";

// Portfolio writes (approval-gated)
import { createPortfolioRecord } from "./create-portfolio-record";
import { createPosition } from "./create-position";
import { getPositionCategories } from "./position-categories";

export const aiTools = {
  getPortfolioOverview: routedTool({
    telemetryRoutes: ["general"],
    description:
      "Get a comprehensive portfolio overview including the user's financial profile, gross net worth, asset allocation, and all positions at any given date. Optionally include net worth after estimated capital gains taxes. Returns: summary, financial profile, net worth values, positions count, asset categories with percentages, and detailed position information with values converted to base currency.",
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
      includeAfterTax: z
        .boolean()
        .nullable()
        .describe(
          "Set true to also compute netWorthAfterCapitalGains and estimatedCapitalGainsTax. Default is false.",
        ),
    }),
    execute: async (args) => {
      return getPortfolioOverview(args);
    },
  }),

  getPositions: routedTool({
    telemetryRoutes: ["general"],
    description:
      "Get raw positions in original currencies (no FX conversion). Optionally filter by position IDs. Uses market prices as-of the given date (defaults to today) for market-backed positions (e.g., securities, domains, etc.). Category fields: category_id is the canonical Foliofox system category id; category is the user-facing category label; display_category_id is the user-facing grouping id.",
    inputSchema: z.object({
      positionIds: z
        .array(z.string())
        .nullable()
        .describe(
          "Position UUID from getPortfolioOverview or getPositions (positions[].id).",
        ),
      date: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getPositions(args),
  }),

  getPortfolioRecords: routedTool({
    telemetryRoutes: ["general"],
    description:
      "Get portfolio records history with optional filtering. Returns: record list with type, date, quantity, unit value, position details, and metadata. Supports filtering by position, date range, and archived status.",
    inputSchema: z.object({
      positionId: z
        .string()
        .nullable()
        .describe(
          "Position UUID from getPortfolioOverview or getPositions (positions[].id). If omitted, returns records for all positions.",
        ),
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

  getPositionSnapshots: routedTool({
    telemetryRoutes: ["chart"],
    description:
      "Get historical snapshots (quantity and unit value) for a specific position. Returns: snapshot list with date, quantity, unit value, total value, and currency. Useful for analyzing position performance over time.",
    inputSchema: z.object({
      positionId: z
        .string()
        .describe(
          "Position UUID from getPortfolioOverview or getPositions (positions[].id).",
        ),
      startDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
      endDate: z.string().nullable().describe("YYYY-MM-DD format (optional)"),
    }),
    execute: async (args) => {
      return getPositionSnapshots(args);
    },
  }),

  getNetWorthHistory: routedTool({
    telemetryRoutes: ["chart"],
    description:
      "Get net worth history over time to analyze financial trends. Supports gross mode or after-capital-gains-tax mode. Returns chronological values with dates, period information, and historyQuality metadata (including whether history is suitable for return-drift estimation). Leading zero-only history is trimmed from returned items to keep the series representative.",
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
      mode: z
        .enum(NET_WORTH_MODES)
        .nullable()
        .describe(
          "Net worth mode: 'gross' or 'after_capital_gains'. Leave empty for gross.",
        ),
    }),
    execute: async (args) => {
      return getNetWorthHistory(args);
    },
  }),

  getNetWorthChange: routedTool({
    telemetryRoutes: ["general"],
    description:
      "Get net worth change over a specified period to analyze portfolio performance. Supports gross mode or after-capital-gains-tax mode. Returns current vs previous values, absolute change amount, percentage change, and direction. Shows portfolio growth rate and momentum.",
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
      mode: z
        .enum(NET_WORTH_MODES)
        .nullable()
        .describe(
          "Net worth mode: 'gross' or 'after_capital_gains'. Leave empty for gross.",
        ),
    }),
    execute: async (args) => {
      return getNetWorthChange(args);
    },
  }),

  getProjectedIncome: routedTool({
    telemetryRoutes: ["chart"],
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

  getAssetsPerformance: routedTool({
    telemetryRoutes: ["general"],
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
          "Position UUIDs from getPortfolioOverview or getPositions (positions[].id). If omitted, analyzes all assets.",
        ),
      startDate: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to 365 days ago)"),
      endDate: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD format (optional, defaults to today)"),
    }),
    execute: async (args) => getAssetsPerformance(args),
  }),

  getTopMovers: routedTool({
    telemetryRoutes: ["general"],
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

  getAllocationDrift: routedTool({
    telemetryRoutes: ["general"],
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

  getCurrencyExposure: routedTool({
    telemetryRoutes: ["general"],
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

  getDividendYield: routedTool({
    telemetryRoutes: ["general"],
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

  getHistoricalQuotes: routedTool({
    telemetryRoutes: ["chart"],
    description:
      "Retrieve daily historical prices for a symbol across a limited date range (≤365 days). Use this for chart-ready data on specific symbols. Do not fan out this tool across an entire portfolio in one turn; for broad screening, use aggregate analysis tools first or ask the user to narrow scope (e.g., top movers, one category, or up to 5 symbols). If you're unsure about the Yahoo Finance ticker symbol, call searchSymbols first to confirm the correct symbol before invoking this tool.",
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

  getHistoricalQuotesBatch: routedTool({
    telemetryRoutes: ["chart"],
    description:
      "Retrieve daily historical prices for multiple symbols in one call (max 10 symbols, ≤365 days). Prefer this over repeated getHistoricalQuotes calls when screening multiple holdings in the same period.",
    inputSchema: z.object({
      symbolLookups: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe(
          "Symbol lookup values (tickers, aliases, or canonical UUIDs). Maximum 10 symbols per batch.",
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
    execute: async (args) => getHistoricalQuotesBatch(args),
  }),

  searchSymbols: routedTool({
    telemetryRoutes: ["identifier"],
    description:
      "Find the correct Yahoo Finance symbol for a company name or validate a symbol. " +
      "Yahoo Finance uses exchange SUFFIXES, not prefixes: RACE (NYSE), RACE.MI (Milan), " +
      "VOD.L (London), SAP.DE (Frankfurt), RY.TO (Toronto), BHP.AX (Australia). " +
      "When user wants a specific exchange: try the ticker with suffix directly (e.g., 'RACE.MI'), " +
      "or search the company name with limit 5-10 and check the 'exchange' field in results. " +
      "Returns: matching symbols with company names, exchanges, and types.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Company name (e.g., 'Apple', 'Ferrari'), ticker (e.g., 'AAPL', 'RACE'), " +
            "or ticker with exchange suffix (e.g., 'RACE.MI' for Milan, 'VOD.L' for London).",
        ),
      limit: z
        .number()
        .nullable()
        .describe(
          "Maximum results to return. Use 5-10 for multi-exchange stocks to see all listings. Default: 10, max: 20.",
        ),
    }),
    execute: async (args) => searchSymbols(args),
  }),

  getNews: routedTool({
    telemetryRoutes: ["general"],
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

  getFinancialScenarios: routedTool({
    telemetryRoutes: ["chart"],
    description:
      "Get the user's financial scenario (scenario planning) with income/expense events and optional simulation. Returns: scenario name, initial value, events with conditions and recurrence, and optionally runs a forward simulation showing projected balances over time. Useful for analyzing financial plans, projections, and 'what-if' scenarios. Use this when the user asks about their scenario plan, future projections, or wants advice on their planned income/expense events.",
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

  getProductReference: routedTool({
    telemetryRoutes: ["general"],
    description:
      "Get the Foliofox product reference explaining how the app itself works: CSV import formats and columns, supported broker files (Trade Republic, Scalable Capital, Directa), adding assets, field meanings (quantity, unit value, cost basis per unit, capital gains tax rate), buy/sell/update records, categories, currencies, and sharing. Call this before answering any question about using Foliofox.",
    inputSchema: z.object({}),
    execute: async () => getProductReference(),
  }),

  getPositionCategories: routedTool({
    telemetryRoutes: ["general"],
    description:
      "List valid position categories: Foliofox system categories plus the user's custom categories. Call this before createPosition to pick a real category id, unless the category is clearly 'other'. Returns: id, name, source (system|custom), category_id, user_category_id, position_type.",
    inputSchema: z.object({
      positionType: z
        .enum(["asset", "liability"])
        .nullable()
        .describe("Filter by position type. Leave empty for 'asset'."),
    }),
    execute: async (args) => getPositionCategories(args),
  }),

  createPortfolioRecord: routedTool({
    telemetryRoutes: ["write"],
    description:
      "Create a portfolio record (buy, sell, or update) for an EXISTING position. This modifies the user's portfolio and always requires the user's explicit approval in the chat UI before executing. Use real data gathered from read tools; never invent quantities, prices, or dates. Returns { success } or { success: false, code, message }.",
    inputSchema: z.object({
      summary: z
        .string()
        .describe(
          "One-line human-readable description of the action, shown on the user's approval card. Example: 'Buy 20 × AAPL @ 211.50 USD on 2026-07-18'.",
        ),
      positionId: z
        .string()
        .describe(
          "Position UUID from getPortfolioOverview or getPositions (positions[].id).",
        ),
      type: z
        .enum(["buy", "sell", "update"])
        .describe(
          "'buy' adds quantity, 'sell' removes quantity, 'update' resets quantity and unit value at a date.",
        ),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Record date in YYYY-MM-DD format."),
      quantity: z
        .number()
        .min(0)
        .describe(
          "Units bought/sold, or the new total quantity for 'update' records.",
        ),
      unitValue: z
        .number()
        .min(0)
        .describe("Price per unit in the position's own currency."),
      description: z
        .string()
        .nullable()
        .describe("Optional note stored on the record."),
      costBasisPerUnit: z
        .number()
        .min(0)
        .nullable()
        .describe(
          "Only for 'update' records: custom cost basis per unit. Leave empty otherwise.",
        ),
    }),
    // The stable tool-call id makes a retried approval continuation a no-op
    // instead of a duplicate record (unique index on idempotency_key).
    execute: async (args, { toolCallId }) =>
      createPortfolioRecord({ ...args, idempotencyKey: toolCallId }),
  }),

  createPosition: routedTool({
    telemetryRoutes: ["write"],
    description:
      "Create a NEW position (asset or future liability) with an initial snapshot. Only for holdings not yet tracked; for existing positions use createPortfolioRecord. This modifies the user's portfolio and always requires the user's explicit approval in the chat UI before executing. For market-traded assets provide symbolLookup (confirm the ticker with searchSymbols first); the current market price is used automatically when unitValue is empty. Returns { success } or { success: false, code, message }.",
    inputSchema: z.object({
      summary: z
        .string()
        .describe(
          "One-line human-readable description of the action, shown on the user's approval card. Example: 'Add position VWCE.DE: 15 units @ 130.20 EUR (ETFs)'.",
        ),
      name: z.string().describe("Position display name, unique per user."),
      currency: z
        .string()
        .describe(
          "ISO currency code of the position (e.g., USD, EUR). For symbol-linked positions, always use the symbol's trading currency (check searchSymbols/exchange if unsure).",
        ),
      type: z
        .enum(["asset", "liability"])
        .nullable()
        .describe("Leave empty for 'asset'."),
      categoryId: z
        .string()
        .nullable()
        .describe(
          "System category id from getPositionCategories. Leave empty to use 'other' or when userCategoryId is set.",
        ),
      userCategoryId: z
        .string()
        .nullable()
        .describe(
          "Custom category UUID from getPositionCategories (source 'custom').",
        ),
      symbolLookup: z
        .string()
        .nullable()
        .describe(
          "Yahoo Finance ticker for market-traded assets (e.g., 'AAPL', 'VWCE.DE'). Use searchSymbols first if unsure. Leave empty for custom/manual positions.",
        ),
      quantity: z
        .number()
        .min(0)
        .nullable()
        .describe("Initial quantity. Leave empty for 0."),
      unitValue: z
        .number()
        .min(0)
        .nullable()
        .describe(
          "Price per unit in the position currency. Leave empty to use the current market price when symbolLookup is set.",
        ),
      costBasisPerUnit: z
        .number()
        .min(0)
        .nullable()
        .describe(
          "Purchase cost per unit. Leave empty to default to the unit value.",
        ),
      capitalGainsTaxRate: z
        .number()
        .min(0)
        .max(100)
        .nullable()
        .describe("Capital gains tax rate percentage, 0-100 (e.g., 26)."),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .describe(
          "Initial snapshot date in YYYY-MM-DD format. Leave empty for today.",
        ),
      description: z
        .string()
        .nullable()
        .describe("Optional note stored on the position."),
    }),
    execute: async (args) => createPosition(args),
  }),
};
