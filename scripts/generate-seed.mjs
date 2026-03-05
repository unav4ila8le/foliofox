#!/usr/bin/env node
/**
 * Seed data generator for Foliofox local development.
 *
 * Produces supabase/seed.sql with a realistic two-year portfolio
 * (March 2024 – March 2026), ~160 records across 15 asset positions,
 * with correct running quantities and weighted-average cost basis.
 *
 * Usage:
 *   node scripts/generate-seed.mjs > supabase/seed.sql
 */

import { randomUUID } from "node:crypto";

const USER_ID = "f7e710c7-2e9c-4925-a8d8-6a13def5fe41";
const IDENTITY_ID = "e9ad1c46-1ce4-415f-9e39-12a1e9f617d6";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sq(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function emit(line) {
  process.stdout.write(line + "\n");
}

function dayBefore(dateKey, hoursUtc = 18) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(hoursUtc, 0, 0, 0);
  return d.toISOString().replace("T", " ").replace("Z", "+00");
}

function recordTimestamp(dateKey, indexInPosition) {
  const hh = String(9 + Math.floor(indexInPosition / 60)).padStart(2, "0");
  const mm = String(indexInPosition % 60).padStart(2, "0");
  return `${dateKey} ${hh}:${mm}:00+00`;
}

function snapshotTimestamp(dateKey, indexInPosition) {
  const hh = String(9 + Math.floor(indexInPosition / 60)).padStart(2, "0");
  const mm = String(indexInPosition % 60).padStart(2, "0");
  return `${dateKey} ${hh}:${mm}:30+00`;
}

function daysBetweenKeys(dateKeyA, dateKeyB) {
  const a = new Date(`${dateKeyA}T00:00:00Z`);
  const b = new Date(`${dateKeyB}T00:00:00Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ── Cost-basis logic (mirrors server/position-snapshots/record-transition.ts)

function applyTransition(state, type, quantity, unitValue) {
  let nextQuantity = state.quantity;
  let nextCostBasis = state.costBasis;

  if (type === "buy") {
    if (nextQuantity > 0) {
      const totalCost = nextQuantity * nextCostBasis + quantity * unitValue;
      nextQuantity += quantity;
      nextCostBasis = totalCost / nextQuantity;
    } else {
      nextQuantity = quantity;
      nextCostBasis = unitValue;
    }
  } else if (type === "sell") {
    nextQuantity = Math.max(0, nextQuantity - quantity);
  } else if (type === "update") {
    nextQuantity = quantity;
    nextCostBasis = unitValue;
  }

  return { quantity: nextQuantity, costBasis: nextCostBasis };
}

// ── Symbol definitions ───────────────────────────────────────────────────────

const symbols = [
  {
    id: "3be27f4e-abb4-48e0-a6ad-f07ce912e225",
    ticker: "AAPL",
    shortName: "Apple Inc.",
    longName: "Apple Inc.",
    exchange: "NasdaqGS",
    sector: "Technology",
    industry: "Consumer Electronics",
    quoteType: "EQUITY",
    currency: "USD",
    createdAt: "2024-03-17 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "f8286436-09d7-4e8a-bdd1-d064c2e22cc3",
    ticker: "MSFT",
    shortName: "Microsoft Corporation",
    longName: "Microsoft Corporation",
    exchange: "NasdaqGS",
    sector: "Technology",
    industry: "Software - Infrastructure",
    quoteType: "EQUITY",
    currency: "USD",
    createdAt: "2024-04-02 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "ca09e75c-bc04-43ac-99be-38428d41e2e3",
    ticker: "9984.T",
    shortName: "SOFTBANK GROUP CORP",
    longName: "SoftBank Group Corp.",
    exchange: "Tokyo",
    sector: "Communication Services",
    industry: "Telecom Services",
    quoteType: "EQUITY",
    currency: "JPY",
    createdAt: "2024-04-11 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "3668309d-81a3-4da5-92d8-574f0c732059",
    ticker: "SPY",
    shortName: "State Street SPDR S&P 500 ETF T",
    longName: "State Street SPDR S&P 500 ETF Trust",
    exchange: "NYSEArca",
    sector: null,
    industry: null,
    quoteType: "ETF",
    currency: "USD",
    createdAt: "2024-03-21 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "dac3d827-8da1-4547-88a8-a5327e12db97",
    ticker: "0700.HK",
    shortName: "TENCENT",
    longName: "Tencent Holdings Limited",
    exchange: "HKSE",
    sector: "Communication Services",
    industry: "Internet Content & Information",
    quoteType: "EQUITY",
    currency: "HKD",
    createdAt: "2024-03-24 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "8f78e671-8724-4f0a-a2df-9595ea334e2d",
    ticker: "VWCE.DE",
    shortName: "Vanguard FTSE All-World U.ETF R",
    longName: "Vanguard FTSE All-World UCITS ETF USD Accumulation",
    exchange: "XETRA",
    sector: null,
    industry: null,
    quoteType: "ETF",
    currency: "EUR",
    createdAt: "2024-04-07 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "277aa1b9-8ab2-4012-a51c-43d3cd1e2e95",
    ticker: "BTC-USD",
    shortName: "Bitcoin USD",
    longName: "Bitcoin USD",
    exchange: "CCC",
    sector: null,
    industry: null,
    quoteType: "CRYPTOCURRENCY",
    currency: "USD",
    createdAt: "2024-03-14 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "502c0cb4-7383-4823-a2d0-c81004358efd",
    ticker: "ETH-USD",
    shortName: "Ethereum USD",
    longName: "Ethereum USD",
    exchange: "CCC",
    sector: null,
    industry: null,
    quoteType: "CRYPTOCURRENCY",
    currency: "USD",
    createdAt: "2024-04-09 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
  {
    id: "0a687a82-1a20-4fb3-93b9-ac334f1e2249",
    ticker: "GLD",
    shortName: "SPDR Gold Shares",
    longName: "SPDR Gold Shares",
    exchange: "NYSEArca",
    sector: null,
    industry: null,
    quoteType: "ETF",
    currency: "USD",
    createdAt: "2024-05-01 14:00:00+00",
    lastQuoteAt: "2026-03-03 00:00:00+00",
  },
];

// ── Position definitions ─────────────────────────────────────────────────────

const positions = [
  {
    id: "783a1cd3-d79b-4932-882f-580ae323adb4",
    name: "Hong Kong Cash",
    currency: "HKD",
    categoryId: "cash",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "8bc59f8d-62a7-40e1-9cc8-e7647e6a1c4c",
    name: "Operating Cash",
    currency: "USD",
    categoryId: "cash",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "3f273f7e-b950-457c-96f3-8964e4e60c1d",
    name: "Apple Inc",
    currency: "USD",
    categoryId: "equity",
    symbolId: "3be27f4e-abb4-48e0-a6ad-f07ce912e225",
    domainId: null,
    capitalGainsTaxRate: 0.26,
  },
  {
    id: "4b0f79d8-88d3-45e9-8b78-b1c0efe9ced6",
    name: "Microsoft Corp",
    currency: "USD",
    categoryId: "equity",
    symbolId: "f8286436-09d7-4e8a-bdd1-d064c2e22cc3",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "fddf0cc4-7c0e-45d7-baf2-60f39b70f0f7",
    name: "SoftBank Group",
    currency: "JPY",
    categoryId: "equity",
    symbolId: "ca09e75c-bc04-43ac-99be-38428d41e2e3",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "4a962e75-0785-4e85-b365-6ca88db8a07e",
    name: "SPDR S&P 500 ETF",
    currency: "USD",
    categoryId: "equity",
    symbolId: "3668309d-81a3-4da5-92d8-574f0c732059",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "48621b08-2009-4c7e-aee4-bec4e0a9eecd",
    name: "Tencent Holdings",
    currency: "HKD",
    categoryId: "equity",
    symbolId: "dac3d827-8da1-4547-88a8-a5327e12db97",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "a93bb7de-264e-46b7-8af0-70eaa34b96dc",
    name: "Vanguard FTSE All-World (Acc)",
    currency: "EUR",
    categoryId: "equity",
    symbolId: "8f78e671-8724-4f0a-a2df-9595ea334e2d",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "4852f410-ea7b-40fd-88a2-8f04ec6a0a5a",
    name: "US Treasury 10Y Notes",
    currency: "USD",
    categoryId: "fixed_income",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "e4c8fce4-641a-4267-a605-53d525ff7cf3",
    name: "US Treasury 2Y Notes",
    currency: "USD",
    categoryId: "fixed_income",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "6ee6ecd1-001a-4541-9de1-86182cb0b3fa",
    name: "Milan Apartment",
    currency: "EUR",
    categoryId: "real_estate",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: 0.2,
  },
  {
    id: "d7d82192-5595-44b2-9042-1f4e889b198d",
    name: "Bitcoin",
    currency: "USD",
    categoryId: "cryptocurrency",
    symbolId: "277aa1b9-8ab2-4012-a51c-43d3cd1e2e95",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "8a351b96-72e1-400f-bfa3-144ecb909231",
    name: "Ethereum",
    currency: "USD",
    categoryId: "cryptocurrency",
    symbolId: "502c0cb4-7383-4823-a2d0-c81004358efd",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "898b2fea-896b-4041-805c-feeec5f02dcd",
    name: "SPDR Gold Trust",
    currency: "USD",
    categoryId: "commodities",
    symbolId: "0a687a82-1a20-4fb3-93b9-ac334f1e2249",
    domainId: null,
    capitalGainsTaxRate: null,
  },
  {
    id: "44350b6e-5277-4f49-a287-4bf702d7fd3f",
    name: "Private Equity Fund",
    currency: "USD",
    categoryId: "other",
    symbolId: null,
    domainId: null,
    capitalGainsTaxRate: null,
  },
];

// ── Portfolio events ─────────────────────────────────────────────────────────
// Format: [date, type, quantity, unitValue, description]

const portfolioEvents = new Map([
  // Cash positions (HK Cash, Operating Cash) are computed by buildCashTimelines()
  // from the trade activity of non-cash positions in matching currencies.

  // ── Market-backed equities ──
  // Apple Inc (AAPL) — approximate prices: Mar24 $171, Jun24 $196, Jul24 $218,
  // Sep24 $222, Dec24 $241, Jan25 $239, Mar25 $223, Jun25 $198, Jul25 $226,
  // Sep25 $228, Jan26 $241, Feb26 $245
  [
    "3f273f7e-b950-457c-96f3-8964e4e60c1d",
    [
      ["2024-03-18", "buy", 15, 171.48, "Initial purchase"],
      ["2024-06-10", "buy", 8, 196.12, "Added to position"],
      ["2024-07-29", "buy", 3, 218.24, "Monthly DCA"],
      ["2024-09-05", "sell", 5, 222.35, "Profit taking"],
      ["2024-12-02", "buy", 10, 240.76, "Year-end accumulation"],
      ["2025-01-13", "sell", 2, 238.5, "Tax-loss harvesting"],
      ["2025-03-14", "buy", 6, 223.45, "Buying the dip"],
      ["2025-06-20", "sell", 4, 197.8, "Rebalancing"],
      ["2025-07-07", "buy", 4, 225.6, "Buy on strength"],
      ["2025-09-12", "buy", 5, 227.9, "DCA buy"],
      ["2026-01-08", "buy", 2, 241.3, "New year accumulation"],
      ["2026-02-10", "update", 42, 244.5, "Broker reconciliation"],
    ],
  ],

  // Microsoft Corp (MSFT) — approximate prices: Apr24 $428, Jun24 $445,
  // Jul24 $454, Oct24 $425, Dec24 $438, Jan25 $419, Apr25 $388, Aug25 $440,
  // Nov25 $438, Feb26 $409
  [
    "4b0f79d8-88d3-45e9-8b78-b1c0efe9ced6",
    [
      ["2024-04-03", "buy", 8, 428.5, "Initial purchase"],
      ["2024-06-24", "buy", 3, 445.2, "Adding on strength"],
      ["2024-07-15", "buy", 5, 453.72, "Monthly DCA"],
      ["2024-10-22", "buy", 4, 425.3, "Buying dip"],
      ["2024-12-09", "sell", 2, 437.8, "Year-end rebalancing"],
      ["2025-01-20", "sell", 3, 418.6, "Trimmed position"],
      ["2025-04-14", "buy", 6, 388.2, "Buy the dip"],
      ["2025-08-05", "sell", 2, 440.15, "Took profits"],
      ["2025-11-10", "buy", 4, 437.8, "Accumulation"],
      ["2026-02-26", "update", 23, 408.5, "Broker reconciliation"],
    ],
  ],

  // SoftBank Group (9984.T, JPY) — approximate prices: Apr24 ¥8750, Jun24 ¥10450,
  // Aug24 ¥8800, Sep24 ¥8350, Dec24 ¥9280, Feb25 ¥8650, Mar25 ¥8920,
  // Jun25 ¥9150, Sep25 ¥9480, Nov25 ¥9200, Dec25 ¥9120, Feb26 ¥9400
  [
    "fddf0cc4-7c0e-45d7-baf2-60f39b70f0f7",
    [
      ["2024-04-12", "buy", 12, 8750, "Initial purchase"],
      ["2024-06-28", "buy", 8, 10450, "Adding to position"],
      ["2024-08-19", "sell", 3, 8800, "Trimmed on weakness"],
      ["2024-09-16", "buy", 5, 8350, "Buying the dip"],
      ["2024-12-10", "buy", 8, 9280, "Year-end buy"],
      ["2025-02-17", "sell", 5, 8650, "Reducing exposure"],
      ["2025-03-25", "buy", 6, 8920, "DCA"],
      ["2025-06-18", "buy", 4, 9150, "Adding to position"],
      ["2025-09-08", "buy", 3, 9480, "Accumulation"],
      ["2025-11-04", "sell", 2, 9200, "Rebalancing"],
      ["2025-12-15", "buy", 4, 9120, "Year-end top-up"],
      ["2026-02-24", "update", 40, 9400, "Broker reconciliation"],
    ],
  ],

  // SPDR S&P 500 ETF (SPY) — approximate prices: Mar24 $521, May24 $530,
  // Jun24 $544, Sep24 $567, Nov24 $575, Dec24 $591, Feb25 $571, Apr25 $561,
  // Jul25 $597, Sep25 $559, Nov25 $591, Feb26 $590
  [
    "4a962e75-0785-4e85-b365-6ca88db8a07e",
    [
      ["2024-03-22", "buy", 5, 521.3, "Initial purchase"],
      ["2024-05-10", "buy", 2, 530.45, "DCA"],
      ["2024-06-14", "buy", 3, 543.78, "Monthly DCA"],
      ["2024-09-20", "buy", 4, 566.5, "Accumulation"],
      ["2024-11-04", "buy", 2, 574.8, "Adding to position"],
      ["2024-12-30", "sell", 2, 591.2, "Year-end rebalancing"],
      ["2025-02-24", "buy", 2, 570.5, "DCA"],
      ["2025-04-07", "buy", 3, 561.4, "Buy the dip"],
      ["2025-07-22", "buy", 2, 597.3, "DCA"],
      ["2025-09-15", "sell", 3, 558.6, "Took profits"],
      ["2025-11-03", "buy", 2, 590.8, "Accumulation"],
      ["2026-02-20", "update", 20, 590.0, "Broker reconciliation"],
    ],
  ],

  // Tencent Holdings (0700.HK, HKD) — approximate prices: Mar24 HK$306,
  // May24 HK$341, Jul24 HK$366, Aug24 HK$378, Nov24 HK$392, Jan25 HK$419,
  // Apr25 HK$431, May25 HK$458, Aug25 HK$449, Nov25 HK$456, Jan26 HK$473,
  // Feb26 HK$480
  [
    "48621b08-2009-4c7e-aee4-bec4e0a9eecd",
    [
      ["2024-03-25", "buy", 50, 306.2, "Initial purchase"],
      ["2024-05-20", "buy", 30, 340.5, "Adding to position"],
      ["2024-07-15", "buy", 20, 365.8, "Monthly DCA"],
      ["2024-08-12", "buy", 20, 378.0, "Accumulation"],
      ["2024-11-06", "sell", 20, 392.4, "Partial profit taking"],
      ["2025-01-27", "buy", 25, 418.6, "Top-up"],
      ["2025-04-03", "sell", 10, 430.5, "Trimmed position"],
      ["2025-05-15", "buy", 15, 458.3, "Added on strength"],
      ["2025-08-20", "buy", 20, 448.7, "Buy on pullback"],
      ["2025-11-28", "sell", 10, 455.8, "Rebalancing"],
      ["2026-01-22", "buy", 10, 472.5, "New year top-up"],
      ["2026-02-18", "update", 150, 480.0, "Broker reconciliation"],
    ],
  ],

  // Vanguard FTSE All-World (VWCE.DE, EUR) — approximate prices: Apr24 €112,
  // Jun24 €115, Jul24 €117, Oct24 €120, Dec24 €124, Jan25 €123, Apr25 €120,
  // Jun25 €126, Aug25 €122, Nov25 €127, Feb26 €130
  [
    "a93bb7de-264e-46b7-8af0-70eaa34b96dc",
    [
      ["2024-04-08", "buy", 10, 112.3, "Initial purchase"],
      ["2024-06-10", "buy", 5, 115.2, "DCA"],
      ["2024-07-01", "buy", 8, 116.85, "Monthly DCA"],
      ["2024-10-15", "buy", 6, 120.4, "Accumulation"],
      ["2024-12-02", "buy", 4, 123.5, "Year-end DCA"],
      ["2025-01-06", "buy", 5, 122.8, "New year DCA"],
      ["2025-04-21", "buy", 5, 119.5, "Buy the dip"],
      ["2025-06-16", "sell", 4, 125.8, "Rebalancing"],
      ["2025-08-11", "buy", 3, 121.6, "Accumulation"],
      ["2025-11-17", "buy", 4, 127.3, "DCA"],
      ["2026-02-19", "update", 46, 130.0, "Broker reconciliation"],
    ],
  ],

  // ── Custom fixed-income positions ──
  // US Treasury 10Y Notes (unit value ≈ price per unit of par)
  [
    "4852f410-ea7b-40fd-88a2-8f04ec6a0a5a",
    [
      ["2024-03-28", "buy", 2000, 0.954, "Initial purchase"],
      ["2024-06-20", "buy", 1000, 0.962, "Added to bond ladder"],
      ["2024-07-22", "buy", 500, 0.968, "Top-up"],
      ["2024-10-15", "buy", 500, 0.951, "Buying on yield spike"],
      ["2024-11-18", "buy", 500, 0.942, "Accumulation"],
      ["2025-02-10", "update", 4500, 0.958, "Quarter-end valuation"],
      ["2025-06-09", "buy", 800, 0.972, "Top-up"],
      ["2025-09-30", "update", 5300, 0.965, "Quarter-end valuation"],
      ["2025-12-15", "sell", 500, 0.981, "Partial liquidation"],
      ["2026-02-27", "update", 4800, 0.97, "Month-end valuation"],
    ],
  ],

  // US Treasury 2Y Notes
  [
    "e4c8fce4-641a-4267-a605-53d525ff7cf3",
    [
      ["2024-04-15", "buy", 3000, 0.978, "Initial purchase"],
      ["2024-06-28", "buy", 500, 0.982, "Added to position"],
      ["2024-08-05", "buy", 1000, 0.985, "Accumulation"],
      ["2024-10-28", "sell", 200, 0.989, "Partial liquidation"],
      ["2024-12-20", "sell", 300, 0.992, "Maturity reinvestment"],
      ["2025-03-17", "update", 4000, 0.988, "Quarter-end valuation"],
      ["2025-05-19", "buy", 500, 0.99, "Top-up"],
      ["2025-07-14", "buy", 1000, 0.991, "Accumulation"],
      ["2025-10-28", "sell", 800, 0.996, "Took profits on rally"],
      ["2026-01-20", "buy", 300, 0.994, "Rebuilding position"],
      ["2026-02-27", "update", 5000, 1.001, "Month-end valuation"],
    ],
  ],

  // ── Custom real estate ──
  // Milan Apartment (EUR, quantity=1, unit_value = appraised value)
  [
    "6ee6ecd1-001a-4541-9de1-86182cb0b3fa",
    [
      ["2024-04-01", "update", 1, 305000, "Initial appraisal"],
      ["2024-07-15", "update", 1, 307200, "Mid-year valuation"],
      ["2024-08-15", "update", 1, 308500, "Summer valuation"],
      ["2024-10-30", "update", 1, 310000, "Autumn valuation"],
      ["2024-12-28", "update", 1, 312000, "Year-end appraisal"],
      ["2025-04-10", "update", 1, 315800, "Spring valuation"],
      ["2025-06-28", "update", 1, 316500, "Mid-year valuation"],
      ["2025-08-25", "update", 1, 318000, "Summer valuation"],
      ["2025-12-20", "update", 1, 320500, "Year-end appraisal"],
      ["2026-02-27", "update", 1, 322000, "Monthly appraisal"],
    ],
  ],

  // ── Market-backed crypto ──
  // Bitcoin (BTC-USD) — approximate prices: Mar24 $67k, May24 $69k, Aug24 $60k,
  // Oct24 $72k, Nov24 $96k, Jan25 $99k, Feb25 $98k, May25 $104k, Jul25 $97k,
  // Aug25 $95k, Nov25 $92k, Feb26 $86k
  [
    "d7d82192-5595-44b2-9042-1f4e889b198d",
    [
      ["2024-03-15", "buy", 0.15, 67200, "Initial purchase"],
      ["2024-05-28", "buy", 0.08, 68500, "DCA"],
      ["2024-08-19", "buy", 0.1, 59800, "Buying the dip"],
      ["2024-10-28", "buy", 0.05, 72100, "Accumulation"],
      ["2024-11-20", "sell", 0.05, 96400, "Taking profits on rally"],
      ["2025-01-06", "buy", 0.04, 99200, "New year DCA"],
      ["2025-02-03", "buy", 0.04, 97500, "Accumulation"],
      ["2025-05-12", "sell", 0.04, 104200, "Partial profit taking"],
      ["2025-07-14", "buy", 0.03, 96800, "DCA"],
      ["2025-08-25", "buy", 0.02, 94800, "Buy on dip"],
      ["2025-11-14", "update", 0.42, 91500, "Wallet reconciliation"],
      ["2026-02-23", "update", 0.42, 86000, "Wallet reconciliation"],
    ],
  ],

  // Ethereum (ETH-USD) — approximate prices: Apr24 $3480, Jun24 $3520,
  // Jul24 $3050, Oct24 $2620, Dec24 $3400, Jan25 $3380, Apr25 $1850,
  // Jul25 $2680, Oct25 $2450, Dec25 $3650, Feb26 $2500
  [
    "8a351b96-72e1-400f-bfa3-144ecb909231",
    [
      ["2024-04-10", "buy", 1.5, 3480, "Initial purchase"],
      ["2024-06-15", "buy", 0.8, 3520, "DCA"],
      ["2024-07-08", "buy", 1.0, 3050, "Buying the dip"],
      ["2024-10-01", "buy", 0.8, 2620, "Accumulation"],
      ["2024-12-18", "sell", 0.3, 3400, "Took profits"],
      ["2025-01-13", "sell", 0.5, 3380, "Rebalancing"],
      ["2025-04-28", "buy", 1.2, 1850, "Major dip buy"],
      ["2025-07-21", "sell", 0.3, 2680, "Trimmed position"],
      ["2025-10-15", "buy", 0.8, 2450, "DCA"],
      ["2025-12-22", "sell", 0.5, 3650, "Year-end profit taking"],
      ["2026-02-27", "update", 4.5, 2500, "Wallet reconciliation"],
    ],
  ],

  // ── Market-backed commodities ──
  // SPDR Gold Trust (GLD) — approximate prices: May24 $209, Aug24 $235,
  // Nov24 $243, Dec24 $244, Mar25 $270, Jun25 $286, Sep25 $249, Nov25 $250,
  // Dec25 $244, Feb26 $264
  [
    "898b2fea-896b-4041-805c-feeec5f02dcd",
    [
      ["2024-05-02", "buy", 8, 208.5, "Initial purchase"],
      ["2024-08-27", "buy", 5, 235.4, "Adding to hedge"],
      ["2024-11-11", "buy", 3, 242.8, "Accumulation"],
      ["2024-12-05", "sell", 2, 244.2, "Rebalancing"],
      ["2025-03-20", "buy", 4, 269.8, "Buy on momentum"],
      ["2025-06-30", "sell", 3, 285.5, "Took profits"],
      ["2025-09-22", "buy", 6, 248.9, "Buy on pullback"],
      ["2025-11-03", "sell", 2, 250.4, "Rebalancing"],
      ["2025-12-08", "buy", 3, 243.6, "Year-end buy"],
      ["2026-02-25", "update", 22, 264.0, "Broker reconciliation"],
    ],
  ],

  // ── Custom alternative investment ──
  // Private Equity Fund (quarterly NAV updates)
  [
    "44350b6e-5277-4f49-a287-4bf702d7fd3f",
    [
      ["2024-04-30", "update", 1, 19500, "Initial NAV report"],
      ["2024-07-15", "update", 1, 19650, "Q1 NAV update"],
      ["2024-08-15", "update", 1, 19800, "Q2 NAV report"],
      ["2024-11-30", "update", 1, 20100, "Q3 NAV report"],
      ["2025-02-28", "update", 1, 20350, "Q4 NAV report"],
      ["2025-05-31", "update", 1, 20600, "Q1 NAV report"],
      ["2025-08-31", "update", 1, 20150, "Q2 NAV report (writedown)"],
      ["2025-10-15", "update", 1, 20450, "Q3 interim update"],
      ["2025-11-30", "update", 1, 20800, "Q3 NAV report"],
      ["2026-02-26", "update", 1, 21200, "Q4 NAV report"],
    ],
  ],
]);

// ── Cash timeline builder ────────────────────────────────────────────────────
// Derives cash position updates from the buy/sell activity of non-cash
// positions in the same currency, plus simulated monthly income.

function buildCashTimelines() {
  const configs = [
    {
      positionId: "8bc59f8d-62a7-40e1-9cc8-e7647e6a1c4c",
      currency: "USD",
      startBalance: 60000,
      monthlyIncome: 2000,
      openDate: "2024-03-12",
    },
    {
      positionId: "783a1cd3-d79b-4932-882f-580ae323adb4",
      currency: "HKD",
      startBalance: 48000,
      monthlyIncome: 1500,
      openDate: "2024-03-20",
    },
  ];

  for (const config of configs) {
    // 1. Collect buy/sell cash impacts from non-cash positions
    const tradesByDate = new Map();

    for (const [posId, events] of portfolioEvents) {
      const pos = positions.find((p) => p.id === posId);
      if (!pos || pos.categoryId === "cash" || pos.currency !== config.currency)
        continue;

      for (const [date, type, qty, price] of events) {
        if (type !== "buy" && type !== "sell") continue;
        const amount = type === "buy" ? -(qty * price) : qty * price;
        tradesByDate.set(date, (tradesByDate.get(date) ?? 0) + amount);
      }
    }

    // 2. Monthly income on the 1st of each month (Apr 2024 – Feb 2026)
    const incomeByDate = new Map();
    for (let year = 2024; year <= 2026; year++) {
      const startMonth = year === 2024 ? 4 : 1;
      const endMonth = year === 2026 ? 2 : 12;
      for (let month = startMonth; month <= endMonth; month++) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-01`;
        incomeByDate.set(dateKey, config.monthlyIncome);
      }
    }

    // 3. Merge and sort all dates
    const allDates = [
      ...new Set([...tradesByDate.keys(), ...incomeByDate.keys()]),
    ].sort();

    // 4. Walk through dates, emit cash updates on trade days and periodic gaps
    let balance = config.startBalance;
    const cashEvents = [];
    let lastEmitDate = config.openDate;

    cashEvents.push([
      config.openDate,
      "update",
      Math.round(balance),
      1,
      "Opening balance",
    ]);

    for (const date of allDates) {
      balance += tradesByDate.get(date) ?? 0;
      balance += incomeByDate.get(date) ?? 0;

      const hasTrade = tradesByDate.has(date);
      const daysSince = daysBetweenKeys(lastEmitDate, date);

      if (hasTrade || daysSince >= 21) {
        cashEvents.push([
          date,
          "update",
          Math.round(balance),
          1,
          hasTrade ? "Balance after transfers" : "Monthly balance",
        ]);
        lastEmitDate = date;
      }
    }

    // Ensure a final update near the end of the timeline
    const lastDate = cashEvents[cashEvents.length - 1][0];
    if (lastDate < "2026-02-20") {
      cashEvents.push([
        "2026-02-28",
        "update",
        Math.round(balance),
        1,
        "Month-end balance",
      ]);
    }

    portfolioEvents.set(config.positionId, cashEvents);
  }
}

// ── Process all events ───────────────────────────────────────────────────────

function processAllEvents() {
  const records = [];
  const snapshots = [];

  for (const position of positions) {
    const events = portfolioEvents.get(position.id) ?? [];
    let state = { quantity: 0, costBasis: 0 };

    for (let i = 0; i < events.length; i++) {
      const [date, type, quantity, unitValue, description] = events[i];
      const recordId = randomUUID();
      const snapshotId = randomUUID();
      const createdAt = recordTimestamp(date, i);
      const snapshotCreated = snapshotTimestamp(date, i);

      state = applyTransition(state, type, quantity, unitValue);

      if (state.quantity < -1e-9) {
        throw new Error(
          `Negative running quantity for ${position.name} on ${date}: ${state.quantity}`,
        );
      }

      records.push({
        id: recordId,
        userId: USER_ID,
        positionId: position.id,
        type,
        date,
        quantity,
        unitValue,
        description,
        createdAt,
      });

      snapshots.push({
        id: snapshotId,
        userId: USER_ID,
        positionId: position.id,
        date,
        quantity: state.quantity,
        unitValue,
        costBasisPerUnit: state.costBasis,
        portfolioRecordId: recordId,
        createdAt: snapshotCreated,
      });
    }
  }

  return { records, snapshots };
}

// ── SQL output sections ──────────────────────────────────────────────────────

function outputHeader() {
  emit(
    `-- ============================================================================`,
  );
  emit(`-- Foliofox Local Development Seed Data`);
  emit(
    `-- ============================================================================`,
  );
  emit(`-- This script seeds a test user for local development only.`);
  emit(
    `-- It will NOT run against linked or production projects because seed.sql`,
  );
  emit(`-- is only executed by 'supabase db reset' in local environments.`);
  emit(`--`);
  emit(`-- Test User Credentials:`);
  emit(`--   Email:    test@example.com`);
  emit(`--   Password: Password123!`);
  emit(`--   Username: Testuser`);
  emit(`--`);
  emit(`-- Portfolio spans March 2024 – March 2026 (~2 years).`);
  emit(`-- Generated by: node scripts/generate-seed.mjs > supabase/seed.sql`);
  emit(
    `-- ============================================================================`,
  );
  emit(``);
}

function outputAuthUser() {
  emit(`-- Insert test user into auth.users`);
  emit(
    `-- Password hash generated with: crypt('Password123!', gen_salt('bf'))`,
  );
  emit(`INSERT INTO auth.users (`);
  emit(`    instance_id,`);
  emit(`    id,`);
  emit(`    aud,`);
  emit(`    role,`);
  emit(`    email,`);
  emit(`    encrypted_password,`);
  emit(`    email_confirmed_at,`);
  emit(`    invited_at,`);
  emit(`    confirmation_token,`);
  emit(`    confirmation_sent_at,`);
  emit(`    recovery_token,`);
  emit(`    recovery_sent_at,`);
  emit(`    email_change_token_new,`);
  emit(`    email_change,`);
  emit(`    email_change_sent_at,`);
  emit(`    last_sign_in_at,`);
  emit(`    raw_app_meta_data,`);
  emit(`    raw_user_meta_data,`);
  emit(`    is_super_admin,`);
  emit(`    created_at,`);
  emit(`    updated_at,`);
  emit(`    phone,`);
  emit(`    phone_confirmed_at,`);
  emit(`    phone_change,`);
  emit(`    phone_change_token,`);
  emit(`    phone_change_sent_at,`);
  emit(`    email_change_token_current,`);
  emit(`    email_change_confirm_status,`);
  emit(`    banned_until,`);
  emit(`    reauthentication_token,`);
  emit(`    reauthentication_sent_at,`);
  emit(`    is_sso_user,`);
  emit(`    deleted_at,`);
  emit(`    is_anonymous`);
  emit(`) VALUES (`);
  emit(`    '00000000-0000-0000-0000-000000000000',`);
  emit(`    '${USER_ID}',`);
  emit(`    'authenticated',`);
  emit(`    'authenticated',`);
  emit(`    'test@example.com',`);
  emit(`    crypt('Password123!', gen_salt('bf')),`);
  emit(`    NOW(),`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    '',`);
  emit(`    NULL,`);
  emit(`    NOW(),`);
  emit(`    '{"provider": "email", "providers": ["email"]}',`);
  emit(
    `    '{"sub": "${USER_ID}", "email": "test@example.com", "username": "Testuser", "email_verified": true, "phone_verified": false}',`,
  );
  emit(`    NULL,`);
  emit(`    NOW(),`);
  emit(`    NOW(),`);
  emit(`    NULL,`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    '',`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    0,`);
  emit(`    NULL,`);
  emit(`    '',`);
  emit(`    NULL,`);
  emit(`    false,`);
  emit(`    NULL,`);
  emit(`    false`);
  emit(`) ON CONFLICT (id) DO NOTHING;`);
  emit(``);
}

function outputAuthIdentity() {
  emit(`-- Insert corresponding identity record`);
  emit(`INSERT INTO auth.identities (`);
  emit(`    provider_id,`);
  emit(`    user_id,`);
  emit(`    identity_data,`);
  emit(`    provider,`);
  emit(`    last_sign_in_at,`);
  emit(`    created_at,`);
  emit(`    updated_at,`);
  emit(`    id`);
  emit(`) VALUES (`);
  emit(`    '${USER_ID}',`);
  emit(`    '${USER_ID}',`);
  emit(
    `    '{"sub": "${USER_ID}", "email": "test@example.com", "username": "Testuser", "email_verified": true, "phone_verified": false}',`,
  );
  emit(`    'email',`);
  emit(`    NOW(),`);
  emit(`    NOW(),`);
  emit(`    NOW(),`);
  emit(`    '${IDENTITY_ID}'`);
  emit(`) ON CONFLICT (id) DO NOTHING;`);
  emit(``);
}

function outputProfile() {
  emit(`-- Insert user profile`);
  emit(`INSERT INTO public.profiles (`);
  emit(`    user_id,`);
  emit(`    username,`);
  emit(`    display_currency,`);
  emit(`    avatar_url,`);
  emit(`    created_at,`);
  emit(`    updated_at`);
  emit(`) VALUES (`);
  emit(`    '${USER_ID}',`);
  emit(`    'Testuser',`);
  emit(`    'USD',`);
  emit(`    NULL,`);
  emit(`    NOW(),`);
  emit(`    NOW()`);
  emit(`) ON CONFLICT (user_id) DO NOTHING;`);
  emit(``);
}

function outputSymbols() {
  emit(`-- ==============================================`);
  emit(`-- Symbol Reference Data`);
  emit(`-- ==============================================`);
  emit(``);
  for (const s of symbols) {
    emit(
      `INSERT INTO public.symbols (ticker, short_name, long_name, exchange, sector, industry, created_at, updated_at, quote_type, currency, id, last_quote_at) VALUES (${sq(s.ticker)}, ${sq(s.shortName)}, ${sq(s.longName)}, ${sq(s.exchange)}, ${sq(s.sector)}, ${sq(s.industry)}, ${sq(s.createdAt)}, ${sq(s.createdAt)}, ${sq(s.quoteType)}, ${sq(s.currency)}, ${sq(s.id)}, ${sq(s.lastQuoteAt)}) ON CONFLICT DO NOTHING;`,
    );
  }
  emit(``);
}

function outputPositions() {
  emit(`-- ==============================================`);
  emit(`-- Positions`);
  emit(`-- ==============================================`);
  emit(``);

  for (const p of positions) {
    const events = portfolioEvents.get(p.id) ?? [];
    const firstDate = events.length > 0 ? events[0][0] : "2024-03-15";
    const createdAt = dayBefore(firstDate);
    const cgtRate = p.capitalGainsTaxRate;
    emit(
      `INSERT INTO public.positions (id, user_id, type, name, currency, category_id, archived_at, created_at, updated_at, description, domain_id, symbol_id${cgtRate !== null ? ", capital_gains_tax_rate" : ""}) VALUES (${sq(p.id)}, ${sq(USER_ID)}, 'asset', ${sq(p.name)}, ${sq(p.currency)}, ${sq(p.categoryId)}, NULL, ${sq(createdAt)}, ${sq(createdAt)}, NULL, ${sq(p.domainId)}, ${sq(p.symbolId)}${cgtRate !== null ? `, ${cgtRate}` : ""}) ON CONFLICT DO NOTHING;`,
    );
  }
  emit(``);
}

function outputRecords(records) {
  emit(`-- ==============================================`);
  emit(`-- Portfolio Records`);
  emit(`-- ==============================================`);
  emit(``);

  let currentPosition = null;
  for (const r of records) {
    if (r.positionId !== currentPosition) {
      const posName = positions.find((p) => p.id === r.positionId)?.name;
      if (currentPosition !== null) emit(``);
      emit(`-- ${posName}`);
      currentPosition = r.positionId;
    }
    emit(
      `INSERT INTO public.portfolio_records (id, user_id, position_id, type, date, quantity, unit_value, description, created_at, updated_at) VALUES (${sq(r.id)}, ${sq(r.userId)}, ${sq(r.positionId)}, ${sq(r.type)}, ${sq(r.date)}, ${r.quantity}, ${r.unitValue}, ${sq(r.description)}, ${sq(r.createdAt)}, ${sq(r.createdAt)}) ON CONFLICT DO NOTHING;`,
    );
  }
  emit(``);
}

function outputSnapshots(snapshots) {
  emit(`-- ==============================================`);
  emit(`-- Position Snapshots`);
  emit(`-- ==============================================`);
  emit(``);

  let currentPosition = null;
  for (const s of snapshots) {
    if (s.positionId !== currentPosition) {
      const posName = positions.find((p) => p.id === s.positionId)?.name;
      if (currentPosition !== null) emit(``);
      emit(`-- ${posName}`);
      currentPosition = s.positionId;
    }
    emit(
      `INSERT INTO public.position_snapshots (id, user_id, position_id, date, quantity, unit_value, cost_basis_per_unit, portfolio_record_id, created_at, updated_at) VALUES (${sq(s.id)}, ${sq(s.userId)}, ${sq(s.positionId)}, ${sq(s.date)}, ${s.quantity}, ${s.unitValue}, ${s.costBasisPerUnit}, ${sq(s.portfolioRecordId)}, ${sq(s.createdAt)}, ${sq(s.createdAt)}) ON CONFLICT DO NOTHING;`,
    );
  }
  emit(``);
}

function outputSymbolAliases() {
  emit(`-- ==============================================`);
  emit(`-- Symbol Aliases`);
  emit(`-- ==============================================`);
  emit(``);
  for (const s of symbols) {
    const aliasId = randomUUID();
    emit(
      `INSERT INTO public.symbol_aliases (id, symbol_id, value, type, source, effective_from, effective_to, is_primary, created_at, updated_at) VALUES (${sq(aliasId)}, ${sq(s.id)}, ${sq(s.ticker)}, 'ticker', 'yahoo', ${sq(s.createdAt)}, NULL, true, ${sq(s.createdAt)}, ${sq(s.createdAt)}) ON CONFLICT DO NOTHING;`,
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  buildCashTimelines();
  const { records, snapshots } = processAllEvents();

  outputHeader();
  outputAuthUser();
  outputAuthIdentity();
  outputProfile();
  outputSymbols();
  outputPositions();
  outputRecords(records);
  outputSnapshots(snapshots);
  outputSymbolAliases();
}

main();
