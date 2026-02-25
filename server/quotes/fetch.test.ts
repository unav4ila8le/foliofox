import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredQuoteRow = {
  symbol_id: string;
  date: string;
  close_price: number;
  adjusted_close_price: number;
};

const resolveSymbolsBatchMock = vi.fn();
const resolveSymbolInputMock = vi.fn();
const createServiceClientMock = vi.fn();
const yahooChartMock = vi.fn();

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolsBatch: resolveSymbolsBatchMock,
  resolveSymbolInput: resolveSymbolInputMock,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/server/yahoo-finance/client", () => ({
  yahooFinance: {
    chart: yahooChartMock,
  },
}));

function createSupabaseStub(initialQuotes: StoredQuoteRow[]) {
  const state = {
    quotes: [...initialQuotes],
    cacheQueryCalls: [] as Array<{ symbolIds: string[]; dateKeys: string[] }>,
    upsertCalls: [] as Array<{
      rows: Array<{
        symbol_id: string;
        date: string;
        close_price: number;
        adjusted_close_price: number;
      }>;
      onConflict?: string;
    }>,
    symbolHealthUpdates: [] as Array<{
      ids: string[];
      last_quote_at: string;
    }>,
  };

  const quotesApi = {
    select() {
      let symbolIds: string[] = [];
      let dateKeys: string[] = [];

      return {
        in(column: string, values: string[]) {
          if (column === "symbol_id") {
            symbolIds = values;
          }

          if (column === "date") {
            dateKeys = values;
          }

          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: {
                data: unknown[];
                error: null;
              }) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          state.cacheQueryCalls.push({
            symbolIds: [...symbolIds],
            dateKeys: [...dateKeys],
          });

          const data = state.quotes
            .filter(
              (row) =>
                symbolIds.includes(row.symbol_id) &&
                dateKeys.includes(row.date),
            )
            .map((row) => ({
              symbol_id: row.symbol_id,
              date: row.date,
              close_price: row.close_price,
            }));

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
    },
    async upsert(
      rows: Array<{
        symbol_id: string;
        date: string;
        close_price: number;
        adjusted_close_price: number;
      }>,
      options?: { onConflict?: string },
    ) {
      state.upsertCalls.push({
        rows: rows.map((row) => ({ ...row })),
        onConflict: options?.onConflict,
      });

      rows.forEach((row) => {
        const existingIndex = state.quotes.findIndex(
          (existing) =>
            existing.symbol_id === row.symbol_id && existing.date === row.date,
        );

        if (existingIndex >= 0) {
          state.quotes[existingIndex] = { ...row };
          return;
        }

        state.quotes.push({ ...row });
      });

      return { error: null };
    },
  };

  const symbolsApi = {
    update(payload: { last_quote_at: string }) {
      const validateOrExpression = (expression: string) => {
        if (!expression.includes("last_quote_at")) {
          throw new Error(
            `Expected symbols.or expression to include last_quote_at, got ${expression}`,
          );
        }
      };

      return {
        eq(column: string, id: string) {
          if (column !== "id") {
            throw new Error(
              `Expected symbols.eq to filter by id, got ${column}`,
            );
          }

          return {
            async or(expression: string) {
              validateOrExpression(expression);
              state.symbolHealthUpdates.push({
                ids: [id],
                last_quote_at: payload.last_quote_at,
              });
              return { error: null };
            },
          };
        },
        in(column: string, ids: string[]) {
          if (column !== "id") {
            throw new Error(
              `Expected symbols.in to filter by id, got ${column}`,
            );
          }

          return {
            async or(expression: string) {
              validateOrExpression(expression);
              state.symbolHealthUpdates.push({
                ids: [...ids],
                last_quote_at: payload.last_quote_at,
              });
              return { error: null };
            },
          };
        },
      };
    },
  };

  const client = {
    from(table: string) {
      if (table === "quotes") {
        return quotesApi;
      }

      if (table === "symbols") {
        return symbolsApi;
      }

      throw new Error(`Unexpected table "${table}" requested in test.`);
    },
  };

  return { client, state };
}

function mockSymbolResolution(options?: {
  lookup?: string;
  canonicalId?: string;
  providerAlias?: string;
}) {
  const lookup = options?.lookup ?? "sym-1";
  const canonicalId = options?.canonicalId ?? "sym-1";
  const providerAlias = options?.providerAlias ?? "AAPL";

  resolveSymbolsBatchMock.mockResolvedValue({
    byInput: new Map([[lookup, { canonicalId }]]),
    byCanonicalId: new Map([[canonicalId, { providerAlias }]]),
  });
}

describe("fetchQuotes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));

    resolveSymbolsBatchMock.mockReset();
    resolveSymbolInputMock.mockReset();
    createServiceClientMock.mockReset();
    yahooChartMock.mockReset();

    mockSymbolResolution();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses exact-date cache hit without live fetch", async () => {
    const { client } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-10",
        close_price: 150,
        adjusted_close_price: 150,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes([
      {
        symbolLookup: "sym-1",
        date: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    expect(result.get("sym-1|2026-02-10")).toBe(150);
    expect(yahooChartMock).not.toHaveBeenCalled();
  });

  it("uses latest prior cache row within stale window after live miss", async () => {
    const { client } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-13",
        close_price: 148,
        adjusted_close_price: 148,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 7 },
    );

    expect(result.get("sym-1|2026-02-15")).toBe(148);
    expect(yahooChartMock).toHaveBeenCalledTimes(1);
  });

  it("triggers live fetch when cache is older than stale guard", async () => {
    const { client, state } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-10",
        close_price: 140,
        adjusted_close_price: 140,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-13T00:00:00.000Z"),
          close: 149,
          adjclose: 148,
        },
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 151,
          adjclose: 150,
        },
      ],
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 1 },
    );

    expect(result.get("sym-1|2026-02-15")).toBe(151);
    expect(yahooChartMock).toHaveBeenCalledTimes(1);

    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]?.onConflict).toBe("symbol_id,date");
    expect(state.upsertCalls[0]?.rows).toEqual([
      {
        symbol_id: "sym-1",
        date: "2026-02-13",
        close_price: 149,
        adjusted_close_price: 148,
      },
      {
        symbol_id: "sym-1",
        date: "2026-02-14",
        close_price: 151,
        adjusted_close_price: 150,
      },
    ]);
    expect(
      state.upsertCalls[0]?.rows.some((row) => row.date === "2026-02-15"),
    ).toBe(false);
    expect(state.symbolHealthUpdates).toEqual([
      {
        ids: ["sym-1"],
        last_quote_at: "2026-02-14T00:00:00.000Z",
      },
    ]);
  });

  it("uses previous trading day before cutoff for today requests", async () => {
    vi.setSystemTime(new Date("2026-02-15T21:00:00.000Z"));

    const { client } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-14",
        close_price: 152,
        adjusted_close_price: 152,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes([
      {
        symbolLookup: "sym-1",
        date: new Date("2026-02-15T00:00:00.000Z"),
      },
    ]);

    expect(result.get("sym-1|2026-02-15")).toBe(152);
    expect(yahooChartMock).not.toHaveBeenCalled();
  });

  it("with staleGuardDays=0 forces live fetch on exact-date miss (cron behavior)", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-14",
        close_price: 149,
        adjusted_close_price: 149,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 151,
          adjclose: 150,
        },
      ],
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(yahooChartMock).toHaveBeenCalledTimes(1);
    expect(result.get("sym-1|2026-02-15")).toBe(151);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.cacheQueryCalls).toHaveLength(1);
    expect(state.cacheQueryCalls[0]).toEqual({
      symbolIds: ["sym-1"],
      dateKeys: ["2026-02-15"],
    });
  });

  it("with liveFetchOnMiss=false returns cache-only result on exact miss", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-14",
        close_price: 149,
        adjusted_close_price: 149,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 151,
          adjclose: 150,
        },
      ],
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveFetchOnMiss: false },
    );

    expect(result.get("sym-1|2026-02-15")).toBeUndefined();
    expect(yahooChartMock).not.toHaveBeenCalled();
    expect(state.upsertCalls).toHaveLength(0);
    expect(state.cacheQueryCalls).toHaveLength(1);
    expect(state.cacheQueryCalls[0]).toEqual({
      symbolIds: ["sym-1"],
      dateKeys: ["2026-02-15"],
    });
  });

  it("skips repeated live fetch attempts during miss cooldown window", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "sym-cooldown",
      canonicalId: "sym-cooldown",
      providerAlias: "MSFT",
    });

    yahooChartMock.mockResolvedValue({ quotes: [] });

    const { fetchQuotes } = await import("./fetch");

    const firstResult = await fetchQuotes(
      [
        {
          symbolLookup: "sym-cooldown",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 30 },
    );

    const secondResult = await fetchQuotes(
      [
        {
          symbolLookup: "sym-cooldown",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 30 },
    );

    expect(firstResult.get("sym-cooldown|2026-02-15")).toBeUndefined();
    expect(secondResult.get("sym-cooldown|2026-02-15")).toBeUndefined();
    expect(yahooChartMock).toHaveBeenCalledTimes(1);
  });

  it("re-attempts live fetch after miss cooldown window expires", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "sym-cooldown-expire",
      canonicalId: "sym-cooldown-expire",
      providerAlias: "NVDA",
    });

    yahooChartMock.mockResolvedValue({ quotes: [] });

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-cooldown-expire",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 10 },
    );

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-cooldown-expire",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 10 },
    );

    expect(yahooChartMock).toHaveBeenCalledTimes(2);
  });

  it("does not set cooldown when live fetch fails with an error", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "sym-error-no-cooldown",
      canonicalId: "sym-error-no-cooldown",
      providerAlias: "NFLX",
    });

    yahooChartMock
      .mockRejectedValueOnce(new Error("temporary provider outage"))
      .mockResolvedValueOnce({
        quotes: [
          {
            date: new Date("2026-02-14T00:00:00.000Z"),
            close: 188,
            adjclose: 188,
          },
        ],
      });

    const { fetchQuotes } = await import("./fetch");

    const firstResult = await fetchQuotes(
      [
        {
          symbolLookup: "sym-error-no-cooldown",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 30 },
    );

    const secondResult = await fetchQuotes(
      [
        {
          symbolLookup: "sym-error-no-cooldown",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0, liveMissCooldownMinutes: 30 },
    );

    expect(firstResult.get("sym-error-no-cooldown|2026-02-15")).toBeUndefined();
    expect(secondResult.get("sym-error-no-cooldown|2026-02-15")).toBe(188);
    expect(yahooChartMock).toHaveBeenCalledTimes(2);
  });

  it("batches symbol health updates by market-date groups", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);

    resolveSymbolsBatchMock.mockResolvedValue({
      byInput: new Map([
        ["sym-1", { canonicalId: "sym-1" }],
        ["sym-2", { canonicalId: "sym-2" }],
        ["sym-3", { canonicalId: "sym-3" }],
      ]),
      byCanonicalId: new Map([
        ["sym-1", { providerAlias: "AAPL" }],
        ["sym-2", { providerAlias: "MSFT" }],
        ["sym-3", { providerAlias: "GOOG" }],
      ]),
    });

    yahooChartMock
      .mockResolvedValueOnce({
        quotes: [
          {
            date: new Date("2026-02-14T00:00:00.000Z"),
            close: 101,
            adjclose: 101,
          },
        ],
      })
      .mockResolvedValueOnce({
        quotes: [
          {
            date: new Date("2026-02-14T00:00:00.000Z"),
            close: 202,
            adjclose: 202,
          },
        ],
      })
      .mockResolvedValueOnce({
        quotes: [
          {
            date: new Date("2026-02-13T00:00:00.000Z"),
            close: 303,
            adjclose: 303,
          },
        ],
      });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
        {
          symbolLookup: "sym-2",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
        {
          symbolLookup: "sym-3",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(result.size).toBe(3);
    expect(state.symbolHealthUpdates).toHaveLength(2);
    expect(state.symbolHealthUpdates).toContainEqual({
      ids: ["sym-1", "sym-2"],
      last_quote_at: "2026-02-14T00:00:00.000Z",
    });
    expect(state.symbolHealthUpdates).toContainEqual({
      ids: ["sym-3"],
      last_quote_at: "2026-02-13T00:00:00.000Z",
    });
  });

  it("does not overwrite chart close with regularMarketPrice safety net", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([]);

    createServiceClientMock.mockResolvedValue(client);
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 151,
          adjclose: 150,
        },
      ],
      meta: {
        regularMarketPrice: 999,
        regularMarketTime: new Date("2026-02-14T00:00:00.000Z"),
      },
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(result.get("sym-1|2026-02-15")).toBe(151);
    expect(state.upsertCalls).toHaveLength(1);

    const rowForQuoteDate = state.upsertCalls[0]?.rows.find(
      (row) => row.date === "2026-02-14",
    );
    expect(rowForQuoteDate).toEqual({
      symbol_id: "sym-1",
      date: "2026-02-14",
      close_price: 151,
      adjusted_close_price: 150,
    });
  });
});
