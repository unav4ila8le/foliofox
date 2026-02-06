import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { formatUTCDateKey } from "@/lib/date/date-utils";

import type {
  Dividend,
  DividendEvent,
  TransformedPosition,
} from "@/types/global.types";

const fetchPositionsMock = vi.fn();
const fetchDividendsMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();
const resolveSymbolInputMock = vi.fn();

vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: fetchPositionsMock,
}));

vi.mock("@/server/dividends/fetch", () => ({
  fetchDividends: fetchDividendsMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolInput: resolveSymbolInputMock,
}));

const createDividendSummary = (
  overrides: Partial<Dividend> = {},
): Dividend => ({
  symbol_id: "sym-1",
  forward_annual_dividend: null,
  trailing_ttm_dividend: null,
  dividend_yield: null,
  ex_dividend_date: null,
  last_dividend_date: "2024-12-15",
  inferred_frequency: "monthly",
  pays_dividends: true,
  dividends_checked_at: "2025-01-01",
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
  ...overrides,
});

const createDividendEvent = (
  overrides: Partial<DividendEvent> = {},
): DividendEvent => ({
  id: "event-1",
  symbol_id: "sym-1",
  event_date: "2024-12-15",
  gross_amount: 1,
  currency: "USD",
  source: "yahoo",
  created_at: "2025-01-01",
  ...overrides,
});

const createPosition = (
  overrides: Partial<TransformedPosition> = {},
): TransformedPosition => ({
  id: "pos-1",
  user_id: "user-1",
  name: "Test Asset",
  currency: "USD",
  symbol_id: "sym-1",
  type: "asset",
  category_id: "cat-1",
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
  description: null,
  domain_id: null,
  archived_at: null,
  is_archived: false,
  category_name: "Equity",
  current_quantity: 10,
  current_unit_value: 100,
  total_value: 1000,
  has_market_data: true,
  ...overrides,
  capital_gains_tax_rate: overrides.capital_gains_tax_rate ?? null,
});

describe("projected income", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    fetchPositionsMock.mockReset();
    fetchDividendsMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    resolveSymbolInputMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects monthly income using annual dividend data", async () => {
    const fxDateKey = formatUTCDateKey(new Date());

    fetchPositionsMock.mockResolvedValue([createPosition()]);

    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: 12,
              inferred_frequency: "monthly",
            }),
            events: [],
          },
        ],
      ]),
    );

    fetchExchangeRatesMock.mockResolvedValue(
      new Map([[`USD|${fxDateKey}`, 1]]),
    );

    const { calculateProjectedIncome } =
      await import("@/server/analysis/projected-income/projected-income");

    const result = await calculateProjectedIncome("USD", 12);

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(12);
    result.data?.forEach((month) => {
      expect(month.income).toBe(10);
    });
  });

  it("falls back to dividend_yield * unit value when no annual data exists", async () => {
    const fxDateKey = formatUTCDateKey(new Date());

    fetchPositionsMock.mockResolvedValue([
      createPosition({
        current_quantity: 2,
        current_unit_value: 100,
      }),
    ]);

    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: null,
              forward_annual_dividend: null,
              dividend_yield: 0.05,
              inferred_frequency: null,
            }),
            events: [],
          },
        ],
      ]),
    );

    fetchExchangeRatesMock.mockResolvedValue(
      new Map([[`USD|${fxDateKey}`, 1]]),
    );

    const { calculateSymbolProjectedIncome } =
      await import("@/server/analysis/projected-income/projected-income");

    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "sym-1" },
    });

    const result = await calculateSymbolProjectedIncome("SYM", 2, 1, 100);

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.income).toBeCloseTo(0.8333, 3);
  });

  it("prefers recent payout events when TTM looks inflated", async () => {
    const fxDateKey = formatUTCDateKey(new Date());

    fetchPositionsMock.mockResolvedValue([createPosition()]);

    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: 12,
              inferred_frequency: "monthly",
            }),
            events: [createDividendEvent({ gross_amount: 1 })],
          },
        ],
      ]),
    );

    fetchExchangeRatesMock.mockResolvedValue(
      new Map([[`USD|${fxDateKey}`, 1]]),
    );

    const { calculateProjectedIncome } =
      await import("@/server/analysis/projected-income/projected-income");

    const result = await calculateProjectedIncome("USD", 1);

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.income).toBeCloseTo(0.8333, 3);
  });

  it("returns stacked series data per asset", async () => {
    const fxDateKey = formatUTCDateKey(new Date());

    fetchPositionsMock.mockResolvedValue([
      createPosition({
        id: "pos-1",
        name: "Alpha Asset",
        symbol_id: "sym-1",
        current_quantity: 2,
      }),
    ]);

    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: 12,
              inferred_frequency: "monthly",
            }),
            events: [],
          },
        ],
      ]),
    );

    fetchExchangeRatesMock.mockResolvedValue(
      new Map([[`USD|${fxDateKey}`, 1]]),
    );

    const { calculateProjectedIncomeByAsset } =
      await import("@/server/analysis/projected-income/projected-income");

    const result = await calculateProjectedIncomeByAsset("USD", 1);

    expect(result.success).toBe(true);
    expect(result.series?.length).toBe(1);
    expect(result.series?.[0]).toEqual({
      key: "pos-1",
      positionId: "pos-1",
      symbolId: "sym-1",
      name: "Alpha Asset",
    });
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.values["pos-1"]).toBeCloseTo(2, 6);
    expect(result.data?.[0]?.total).toBeCloseTo(2, 6);
  });
});
