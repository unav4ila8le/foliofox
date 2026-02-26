import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Dividend, DividendEvent } from "@/types/global.types";

const fetchDividendsMock = vi.fn();
const resolveSymbolInputMock = vi.fn();
const fetchSingleQuoteMock = vi.fn();

vi.mock("@/server/dividends/fetch", () => ({
  fetchDividends: fetchDividendsMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolInput: resolveSymbolInputMock,
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchSingleQuote: fetchSingleQuoteMock,
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

describe("symbol projected income", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    fetchDividendsMock.mockReset();
    resolveSymbolInputMock.mockReset();
    fetchSingleQuoteMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to dividend_yield * unit value when no annual data exists", async () => {
    const { calculateSymbolProjectedIncome } =
      await import("@/server/analysis/projected-income/symbol");

    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "sym-1" },
    });
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

    const result = await calculateSymbolProjectedIncome("SYM", 2, 1, 100);

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.income).toBeCloseTo(0.8333, 3);
  });

  it("returns reported dividend yield without fetching live quotes", async () => {
    const { calculateSymbolProjectedIncomePanelData } =
      await import("@/server/analysis/projected-income/symbol");

    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "sym-1" },
    });
    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              dividend_yield: 0.04,
            }),
            events: [createDividendEvent()],
          },
        ],
      ]),
    );

    const result = await calculateSymbolProjectedIncomePanelData(
      "SYM",
      1,
      1,
      100,
      "USD",
    );

    expect(result.projectedIncome.success).toBe(true);
    expect(result.dividendYield).toBe(0.04);
    expect(fetchSingleQuoteMock).not.toHaveBeenCalled();
  });

  it("estimates dividend yield using latest price when reported yield is unavailable", async () => {
    const { calculateSymbolProjectedIncomePanelData } =
      await import("@/server/analysis/projected-income/symbol");

    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "sym-1" },
    });
    fetchDividendsMock.mockResolvedValue(
      new Map([
        [
          "sym-1",
          {
            summary: createDividendSummary({
              trailing_ttm_dividend: null,
              forward_annual_dividend: null,
              dividend_yield: null,
              inferred_frequency: "quarterly",
            }),
            events: [createDividendEvent({ gross_amount: 1 })],
          },
        ],
      ]),
    );
    fetchSingleQuoteMock.mockResolvedValue(50);

    const result = await calculateSymbolProjectedIncomePanelData(
      "SYM",
      1,
      1,
      undefined,
      "USD",
    );

    expect(result.projectedIncome.success).toBe(true);
    expect(result.dividendYield).toBeCloseTo(0.02, 6);
    expect(fetchSingleQuoteMock).toHaveBeenCalledTimes(1);
  });

  it("returns a deterministic unresolved response when symbol cannot be resolved", async () => {
    const { calculateSymbolProjectedIncomePanelData } =
      await import("@/server/analysis/projected-income/symbol");

    resolveSymbolInputMock.mockResolvedValue(null);

    const result = await calculateSymbolProjectedIncomePanelData("UNKNOWN", 1);

    expect(result.projectedIncome.success).toBe(false);
    expect(result.projectedIncome.data).toEqual([]);
    expect(result.projectedIncome.message).toContain(
      'Unable to resolve symbol lookup "UNKNOWN".',
    );
    expect(result.dividendYield).toBeNull();
  });
});
