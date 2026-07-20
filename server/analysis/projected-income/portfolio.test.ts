import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { formatUTCDateKey, toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import type {
  Dividend,
  DividendEvent,
  TransformedPosition,
} from "@/types/global.types";

const fetchPositionsMock = vi.fn();
const fetchDividendsMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();

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
  user_category_id: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
  description: null,
  domain_id: null,
  archived_at: null,
  is_archived: false,
  category_name: "Equity",
  user_category_name: null,
  display_category_id: "cat-1",
  display_category_name: "Equity",
  is_custom_category: false,
  symbol_ticker: null,
  current_quantity: 10,
  current_unit_value: 100,
  total_value: 1000,
  has_market_data: true,
  ...overrides,
  capital_gains_tax_rate: overrides.capital_gains_tax_rate ?? null,
  idempotency_key: null,
});

describe("projected income", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    fetchPositionsMock.mockReset();
    fetchDividendsMock.mockReset();
    fetchExchangeRatesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects monthly income using annual dividend data", async () => {
    const fxDateKey = formatUTCDateKey(new Date());
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-15");

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
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncome(
      "USD",
      12,
      undefined,
      asOfDateKey,
    );

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(12);
    result.data?.forEach((month) => {
      expect(month.income).toBe(10);
    });
  });

  it("prefers recent payout events when TTM looks inflated", async () => {
    const fxDateKey = formatUTCDateKey(new Date());
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-15");

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
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncome(
      "USD",
      1,
      undefined,
      asOfDateKey,
    );

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.income).toBeCloseTo(0.8333, 3);
  });

  it("returns stacked series data per asset", async () => {
    const fxDateKey = formatUTCDateKey(new Date());
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-15");

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
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncomeByAsset(
      "USD",
      1,
      undefined,
      asOfDateKey,
    );

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

  it("prefers the forward annual dividend when trailing annual dividend is clearly inflated", async () => {
    const fxDateKey = formatUTCDateKey(new Date());
    const asOfDateKey = toCivilDateKeyOrThrow("2026-04-10");

    fetchPositionsMock.mockResolvedValue([
      createPosition({
        current_quantity: 1,
        current_unit_value: 211.14,
      }),
    ]);

    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: 95,
              forward_annual_dividend: 5.73,
              dividend_yield: 0.0272,
              inferred_frequency: "semiannual",
              last_dividend_date: "2025-03-31",
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
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncome(
      "USD",
      12,
      undefined,
      asOfDateKey,
    );

    expect(result.success).toBe(true);
    expect(result.data?.[5]?.income).toBeCloseTo(2.865, 3);
    expect(result.data?.[11]?.income).toBeCloseTo(2.865, 3);
    expect(
      result.data?.reduce((sum, month) => sum + month.income, 0),
    ).toBeCloseTo(5.73, 2);
  });

  it("falls back to the latest historical dividend event when annual fields are unavailable", async () => {
    const fxDateKey = formatUTCDateKey(new Date());
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-15");

    fetchPositionsMock.mockResolvedValue([
      createPosition({
        current_quantity: 1,
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
              dividend_yield: null,
              inferred_frequency: "annual",
              last_dividend_date: "2023-12-15",
            }),
            events: [
              createDividendEvent({
                event_date: "2023-12-15",
                gross_amount: 2,
              }),
            ],
          },
        ],
      ]),
    );

    fetchExchangeRatesMock.mockResolvedValue(
      new Map([[`USD|${fxDateKey}`, 1]]),
    );

    const { calculateProjectedIncome } =
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncome(
      "USD",
      12,
      undefined,
      asOfDateKey,
    );

    expect(result.success).toBe(true);
    expect(result.data?.[11]?.income).toBeCloseTo(2, 6);
    expect(
      result.data?.reduce((sum, month) => sum + month.income, 0),
    ).toBeCloseTo(2, 6);
  });

  it("uses the provided civil as-of date key for FX requests", async () => {
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-10");

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

    fetchExchangeRatesMock.mockResolvedValue(new Map([["USD|2025-01-10", 1]]));

    const { calculateProjectedIncome } =
      await import("@/server/analysis/projected-income/portfolio");

    await calculateProjectedIncome("USD", 1, undefined, asOfDateKey);

    const [exchangeRequests] = fetchExchangeRatesMock.mock.calls[0] ?? [];
    expect(Array.isArray(exchangeRequests)).toBe(true);
    expect(
      exchangeRequests.every(
        (request: { date: Date }) =>
          formatUTCDateKey(request.date) === "2025-01-10",
      ),
    ).toBe(true);
  });

  it("passes dividend fetch options and returns empty data when cache has no dividend basis", async () => {
    const asOfDateKey = toCivilDateKeyOrThrow("2025-01-15");

    fetchPositionsMock.mockResolvedValue([createPosition()]);
    fetchDividendsMock.mockResolvedValue(new Map());

    const { calculateProjectedIncome } =
      await import("@/server/analysis/projected-income/portfolio");

    const result = await calculateProjectedIncome(
      "USD",
      1,
      undefined,
      asOfDateKey,
      {
        dividendFetch: {
          refreshMissing: false,
        },
      },
    );

    expect(fetchDividendsMock).toHaveBeenCalledWith([{ symbolId: "sym-1" }], {
      refreshMissing: false,
    });
    expect(fetchExchangeRatesMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: [],
      message: "No dividend-paying positions found in your portfolio",
    });
  });
});
