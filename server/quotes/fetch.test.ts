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
    symbolHealthUpdates: [] as Array<{ id: string; last_quote_at: string }>,
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
      return {
        eq(column: string, id: string) {
          if (column !== "id") {
            throw new Error(
              `Expected symbols.eq to filter by id, got ${column}`,
            );
          }

          return {
            async or(expression: string) {
              if (!expression.includes("last_quote_at")) {
                throw new Error(
                  `Expected symbols.or expression to include last_quote_at, got ${expression}`,
                );
              }

              state.symbolHealthUpdates.push({
                id,
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

  it("uses latest prior cache row within stale window", async () => {
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
    expect(yahooChartMock).not.toHaveBeenCalled();
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
        id: "sym-1",
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
