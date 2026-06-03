import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Dividend, DividendEvent } from "@/types/global.types";

const yahooQuoteSummaryMock = vi.fn();
const yahooChartMock = vi.fn();
const createServiceClientMock = vi.fn();
const resolveSymbolsBatchMock = vi.fn();

vi.mock("@/server/yahoo-finance/client", () => ({
  yahooFinance: {
    quoteSummary: yahooQuoteSummaryMock,
    chart: yahooChartMock,
  },
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolsBatch: resolveSymbolsBatchMock,
}));

interface FakeDividendState {
  events: DividendEvent[];
  summaries: Dividend[];
  upserts: Array<{
    table: string;
    payload: unknown[];
    options?: Record<string, unknown>;
  }>;
}

function createDividendSummary(overrides: Partial<Dividend> = {}): Dividend {
  return {
    symbol_id: "sym-1",
    forward_annual_dividend: null,
    trailing_ttm_dividend: null,
    dividend_yield: null,
    ex_dividend_date: null,
    last_dividend_date: null,
    inferred_frequency: null,
    pays_dividends: true,
    dividends_checked_at: "2025-01-01T00:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createDividendEvent(
  overrides: Partial<DividendEvent> = {},
): DividendEvent {
  return {
    id: "event-1",
    symbol_id: "sym-1",
    event_date: "2024-12-15",
    gross_amount: 1,
    currency: "USD",
    source: "yahoo",
    created_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createFakeServiceClient(state: FakeDividendState) {
  return {
    from(table: string) {
      let symbolIds: string[] = [];
      const gteFilters: Record<string, string> = {};

      const builder = {
        select() {
          return builder;
        },
        in(_column: string, values: string[]) {
          symbolIds = values;
          return builder;
        },
        gte(column: string, value: string) {
          gteFilters[column] = value;
          return builder;
        },
        upsert(payload: unknown[], options?: Record<string, unknown>) {
          state.upserts.push({ table, payload, options });
          return Promise.resolve({ data: null, error: null });
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(resolveSelect()).then(onFulfilled, onRejected);
        },
      };

      function resolveSelect() {
        if (table === "dividend_events") {
          const data = state.events.filter((event) => {
            if (!symbolIds.includes(event.symbol_id)) {
              return false;
            }

            const eventDateThreshold = gteFilters.event_date;
            return (
              !eventDateThreshold ||
              new Date(event.event_date) >= new Date(eventDateThreshold)
            );
          });

          return { data, error: null };
        }

        if (table === "dividends") {
          const data = state.summaries.filter((summary) => {
            if (!symbolIds.includes(summary.symbol_id)) {
              return false;
            }

            const updatedAtThreshold = gteFilters.updated_at;
            return (
              !updatedAtThreshold ||
              new Date(summary.updated_at) >= new Date(updatedAtThreshold)
            );
          });

          return { data, error: null };
        }

        return {
          data: null,
          error: { message: `Unexpected table in test stub: ${table}` },
        };
      }

      return builder;
    },
  };
}

function mockResolvedSymbol() {
  resolveSymbolsBatchMock.mockResolvedValue({
    byInput: new Map([
      [
        "sym-1",
        { canonicalId: "sym-1", currency: "USD", quoteToCurrencyRate: 1 },
      ],
    ]),
    byCanonicalId: new Map([
      [
        "sym-1",
        { providerAlias: "TEST", currency: "USD", quoteToCurrencyRate: 1 },
      ],
    ]),
  });
}

function mockResolvedSymbols(
  symbols: Array<{
    input: string;
    canonicalId: string;
    providerAlias: string;
    currency?: string;
    quoteToCurrencyRate?: number;
  }>,
) {
  resolveSymbolsBatchMock.mockResolvedValue({
    byInput: new Map(
      symbols.map(({ canonicalId, currency, input, quoteToCurrencyRate }) => [
        input,
        {
          canonicalId,
          currency: currency ?? "USD",
          quoteToCurrencyRate: quoteToCurrencyRate ?? 1,
        },
      ]),
    ),
    byCanonicalId: new Map(
      symbols.map(
        ({ canonicalId, currency, providerAlias, quoteToCurrencyRate }) => [
          canonicalId,
          {
            providerAlias,
            currency: currency ?? "USD",
            quoteToCurrencyRate: quoteToCurrencyRate ?? 1,
          },
        ],
      ),
    ),
  });
}

describe("fetchDividends", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T09:00:00.000Z"));
    yahooQuoteSummaryMock.mockReset();
    yahooChartMock.mockReset();
    createServiceClientMock.mockReset();
    resolveSymbolsBatchMock.mockReset();
    mockResolvedSymbol();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns stale cached data without live Yahoo calls when refreshMissing is false", async () => {
    const state: FakeDividendState = {
      events: [
        createDividendEvent({
          id: "old-event",
          event_date: "2020-01-15",
        }),
        createDividendEvent({
          id: "recent-event",
          event_date: "2025-01-15",
        }),
      ],
      summaries: [
        createDividendSummary({
          trailing_ttm_dividend: 12,
          updated_at: "2020-01-01T00:00:00.000Z",
          dividends_checked_at: "2020-01-01T00:00:00.000Z",
        }),
      ],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }], {
      refreshMissing: false,
    });

    expect(yahooQuoteSummaryMock).not.toHaveBeenCalled();
    expect(yahooChartMock).not.toHaveBeenCalled();
    expect(state.upserts).toEqual([]);
    expect(result.get("sym-1")?.summary.trailing_ttm_dividend).toBe(12);
    expect(result.get("sym-1")?.events).toEqual([
      expect.objectContaining({
        id: "recent-event",
        event_date: "2025-01-15",
      }),
    ]);
  });

  it("synthesizes a stale-cache summary from recent events when the summary row is missing", async () => {
    const state: FakeDividendState = {
      events: [
        createDividendEvent({
          id: "first-event",
          event_date: "2025-03-15",
        }),
        createDividendEvent({
          id: "second-event",
          event_date: "2025-06-15",
        }),
      ],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }], {
      refreshMissing: false,
    });

    expect(yahooQuoteSummaryMock).not.toHaveBeenCalled();
    expect(yahooChartMock).not.toHaveBeenCalled();
    expect(result.get("sym-1")?.summary).toEqual(
      expect.objectContaining({
        symbol_id: "sym-1",
        pays_dividends: true,
        inferred_frequency: "quarterly",
        last_dividend_date: "2025-06-15",
      }),
    );
  });

  it("stores a non-payer marker for known Yahoo no-data errors", async () => {
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol: TEST"),
    );
    yahooChartMock.mockResolvedValue({
      events: {},
      meta: { currency: "USD" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }]);

    const dividendSummaryUpsert = state.upserts.find(
      (upsert) => upsert.table === "dividends",
    );
    expect(dividendSummaryUpsert?.payload).toEqual([
      expect.objectContaining({
        symbol_id: "sym-1",
        pays_dividends: false,
        dividends_checked_at: "2026-05-04T09:00:00.000Z",
      }),
    ]);
    expect(result.get("sym-1")?.summary.pays_dividends).toBe(false);
  });

  it("does not cache a non-payer marker for transient provider failures", async () => {
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(new Error("network timeout"));
    yahooChartMock.mockResolvedValue({
      events: {},
      meta: { currency: "USD" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }]);

    expect(state.upserts.some((upsert) => upsert.table === "dividends")).toBe(
      false,
    );
    expect(result.has("sym-1")).toBe(false);
  });

  it("treats rate-limit status errors as transient provider failures", async () => {
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue({
      statusCode: 429,
      message: "Too many requests",
    });
    yahooChartMock.mockResolvedValue({
      events: {},
      meta: { currency: "USD" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }]);

    expect(state.upserts.some((upsert) => upsert.table === "dividends")).toBe(
      false,
    );
    expect(result.has("sym-1")).toBe(false);
  });

  it("returns existing payer summaries when provider refreshes produce no data", async () => {
    const state: FakeDividendState = {
      events: [],
      summaries: [
        createDividendSummary({
          trailing_ttm_dividend: 12,
          updated_at: "2026-05-04T08:00:00.000Z",
          dividends_checked_at: "2026-05-04T08:00:00.000Z",
        }),
      ],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol: TEST"),
    );
    yahooChartMock.mockResolvedValue({
      events: {},
      meta: { currency: "USD" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }]);

    expect(state.upserts.some((upsert) => upsert.table === "dividends")).toBe(
      false,
    );
    expect(result.get("sym-1")?.summary).toEqual(
      expect.objectContaining({
        symbol_id: "sym-1",
        pays_dividends: true,
        trailing_ttm_dividend: 12,
      }),
    );
  });

  it("preserves successful dividend chart events when summary data is unavailable", async () => {
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol: TEST"),
    );
    yahooChartMock.mockResolvedValue({
      events: {
        dividends: [
          {
            date: new Date("2025-12-15T00:00:00.000Z"),
            amount: 1.25,
          },
        ],
      },
      meta: { currency: "USD" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "sym-1" }]);

    expect(result.get("sym-1")?.summary.pays_dividends).toBe(true);
    expect(result.get("sym-1")?.events).toEqual([
      expect.objectContaining({
        event_date: "2025-12-15",
        gross_amount: 1.25,
      }),
    ]);
    expect(
      state.upserts
        .find((upsert) => upsert.table === "dividends")
        ?.payload.at(0),
    ).toEqual(
      expect.objectContaining({
        pays_dividends: true,
        last_dividend_date: "2025-12-15",
      }),
    );
  });

  it("normalizes UK chart dividend event amounts to GBP", async () => {
    mockResolvedSymbols([
      {
        input: "bp-symbol",
        canonicalId: "bp-symbol",
        providerAlias: "BP.L",
        currency: "GBP",
        quoteToCurrencyRate: 0.01,
      },
    ]);
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol: BP.L"),
    );
    yahooChartMock.mockResolvedValue({
      events: {
        dividends: [
          {
            date: new Date("2025-12-15T00:00:00.000Z"),
            amount: 6.1780996,
          },
        ],
      },
      meta: { currency: "GBp" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "bp-symbol" }]);
    const event = result.get("bp-symbol")?.events[0];

    expect(event?.currency).toBe("GBP");
    expect(event?.gross_amount).toBeCloseTo(0.061780996, 10);

    const eventUpsert = state.upserts.find(
      (upsert) => upsert.table === "dividend_events",
    );
    const payloadEvent = eventUpsert?.payload[0] as DividendEvent | undefined;
    expect(payloadEvent?.currency).toBe("GBP");
    expect(payloadEvent?.gross_amount).toBeCloseTo(0.061780996, 10);
  });

  it("normalizes Kuwait chart dividend event amounts to KWD", async () => {
    mockResolvedSymbols([
      {
        input: "nbk-symbol",
        canonicalId: "nbk-symbol",
        providerAlias: "NBK.KW",
        currency: "KWD",
        quoteToCurrencyRate: 0.001,
      },
    ]);
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol: NBK.KW"),
    );
    yahooChartMock.mockResolvedValue({
      events: {
        dividends: [
          {
            date: new Date("2025-12-15T00:00:00.000Z"),
            amount: 35,
          },
        ],
      },
      meta: { currency: "KWF" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "nbk-symbol" }]);
    const event = result.get("nbk-symbol")?.events[0];

    expect(event?.currency).toBe("KWD");
    expect(event?.gross_amount).toBeCloseTo(0.035, 10);
  });

  it("does not quote-unit scale summary dividend amounts", async () => {
    mockResolvedSymbols([
      {
        input: "bp-symbol",
        canonicalId: "bp-symbol",
        providerAlias: "BP.L",
        currency: "GBP",
        quoteToCurrencyRate: 0.01,
      },
    ]);
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockResolvedValue({
      summaryDetail: {
        dividendRate: 1.2,
        trailingAnnualDividendRate: 1.1,
        dividendYield: 0.04,
      },
      calendarEvents: {},
    });
    yahooChartMock.mockResolvedValue({
      events: {
        dividends: [
          {
            date: new Date("2025-12-15T00:00:00.000Z"),
            amount: 6.1780996,
          },
        ],
      },
      meta: { currency: "GBp" },
    });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([{ symbolId: "bp-symbol" }]);
    const summary = result.get("bp-symbol")?.summary;

    expect(summary?.forward_annual_dividend).toBe(1.2);
    expect(summary?.trailing_ttm_dividend).toBe(1.1);
    expect(summary?.dividend_yield).toBe(0.04);
    expect(result.get("bp-symbol")?.events[0]?.gross_amount).toBeCloseTo(
      0.061780996,
      10,
    );
  });

  it("does not fail the whole batch when one Yahoo dividend payload is malformed", async () => {
    mockResolvedSymbols([
      {
        input: "sym-bad",
        canonicalId: "sym-bad",
        providerAlias: "BAD",
      },
      {
        input: "sym-good",
        canonicalId: "sym-good",
        providerAlias: "GOOD",
      },
    ]);
    const state: FakeDividendState = {
      events: [],
      summaries: [],
      upserts: [],
    };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));
    yahooQuoteSummaryMock.mockRejectedValue(
      new Error("No fundamentals data found for symbol"),
    );
    yahooChartMock
      .mockResolvedValueOnce({
        events: {
          dividends: [
            {
              date: "not-a-date",
              amount: 1,
            },
          ],
        },
        meta: { currency: "USD" },
      })
      .mockResolvedValueOnce({
        events: {
          dividends: [
            {
              date: new Date("2025-12-15T00:00:00.000Z"),
              amount: 1.25,
            },
          ],
        },
        meta: { currency: "USD" },
      });

    const { fetchDividends } = await import("./fetch");
    const result = await fetchDividends([
      { symbolId: "sym-bad" },
      { symbolId: "sym-good" },
    ]);

    expect(result.has("sym-bad")).toBe(false);
    expect(result.get("sym-good")?.summary).toEqual(
      expect.objectContaining({
        symbol_id: "sym-good",
        pays_dividends: true,
        last_dividend_date: "2025-12-15",
      }),
    );
    expect(
      state.upserts
        .find((upsert) => upsert.table === "dividends")
        ?.payload.map((summary) => (summary as Dividend).symbol_id),
    ).toEqual(["sym-good"]);
  });
});
