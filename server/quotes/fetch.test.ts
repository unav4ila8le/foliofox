import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoredQuoteRow = {
  symbol_id: string;
  date: string;
  close_price: number;
  adjusted_close_price: number;
};

type StoredSymbolRow = {
  id: string;
  quote_type: string;
  last_quote_at: string | null;
};

type StoredRepairQueueRow = {
  symbol_id: string;
  target_date: string;
  status: string;
  created_at: string;
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

function createSupabaseStub(
  initialQuotes: StoredQuoteRow[],
  options: {
    symbols?: StoredSymbolRow[];
    repairQueue?: StoredRepairQueueRow[];
  } = {},
) {
  const state = {
    quotes: [...initialQuotes],
    symbols: options.symbols ?? [
      {
        id: "sym-1",
        quote_type: "EQUITY",
        last_quote_at: "2026-02-14T00:00:00.000Z",
      },
    ],
    repairQueue: [...(options.repairQueue ?? [])],
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
    repairQueueUpsertCalls: [] as Array<{
      rows: Array<{ symbol_id: string; target_date: string }>;
      onConflict?: string;
      ignoreDuplicates?: boolean;
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
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
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
    select() {
      let symbolIds: string[] = [];

      return {
        in(column: string, values: string[]) {
          if (column !== "id") {
            throw new Error(
              `Expected symbols.in to filter by id, got ${column}`,
            );
          }

          symbolIds = values;
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
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const data = state.symbols.filter((symbol) =>
            symbolIds.includes(symbol.id),
          );

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
    },
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

  const repairQueueApi = {
    select() {
      let symbolIds: string[] = [];
      let statuses: string[] | null = null;
      let createdAtGte: string | null = null;

      return {
        in(column: string, values: string[]) {
          if (column === "symbol_id") {
            symbolIds = values;
            return this;
          }

          if (column === "status") {
            statuses = values;
            return this;
          }

          throw new Error(
            `Expected quote_repair_queue.in to filter by symbol_id/status, got ${column}`,
          );
        },
        gte(column: string, value: string) {
          if (column !== "created_at") {
            throw new Error(
              `Expected quote_repair_queue.gte to filter by created_at, got ${column}`,
            );
          }

          createdAtGte = value;
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
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const data = state.repairQueue
            .filter((row) => {
              if (!symbolIds.includes(row.symbol_id)) return false;
              if (statuses && !statuses.includes(row.status)) return false;
              if (createdAtGte && row.created_at < createdAtGte) return false;
              return true;
            })
            .map((row) => ({
              symbol_id: row.symbol_id,
              status: row.status,
              created_at: row.created_at,
            }));

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
    },
    async upsert(
      rows: Array<{ symbol_id: string; target_date: string }>,
      options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
      },
    ) {
      state.repairQueueUpsertCalls.push({
        rows: rows.map((row) => ({ ...row })),
        onConflict: options?.onConflict,
        ignoreDuplicates: options?.ignoreDuplicates,
      });

      rows.forEach((row) => {
        const existing = state.repairQueue.some(
          (queued) =>
            queued.symbol_id === row.symbol_id &&
            queued.target_date === row.target_date,
        );

        if (existing) return;

        state.repairQueue.push({
          ...row,
          status: "pending",
          created_at: new Date().toISOString(),
        });
      });

      return { error: null };
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

      if (table === "quote_repair_queue") {
        return repairQueueApi;
      }

      throw new Error(`Unexpected table "${table}" requested in test.`);
    },
  };

  return { client, state };
}

function mockSymbolResolution(options?: {
  lookup?: string;
  canonicalId?: string;
  providerAlias?: string | null;
  quoteToCurrencyRate?: number;
}) {
  const lookup = options?.lookup ?? "sym-1";
  const canonicalId = options?.canonicalId ?? "sym-1";
  const providerAlias =
    options?.providerAlias === undefined ? "AAPL" : options.providerAlias;
  const quoteToCurrencyRate = options?.quoteToCurrencyRate ?? 1;

  resolveSymbolsBatchMock.mockResolvedValue({
    byInput: new Map([[lookup, { canonicalId, quoteToCurrencyRate }]]),
    byCanonicalId: new Map([
      [canonicalId, { providerAlias, quoteToCurrencyRate }],
    ]),
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
    mockSymbolResolution({ providerAlias: null });
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
    expect(resolveSymbolsBatchMock).toHaveBeenCalledWith(["sym-1"], {
      provider: "yahoo",
      providerType: "ticker",
      providerAliasMode: "active-only",
      onError: "throw",
    });
  });

  it("uses latest prior cache row within stale window before live fetch", async () => {
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

  it("does not enqueue repair work for exact-date cache hits", async () => {
    const { client, state } = createSupabaseStub([
      {
        symbol_id: "sym-1",
        date: "2026-02-16",
        close_price: 150,
        adjusted_close_price: 150,
      },
    ]);

    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
      ],
      { enqueueExactRepairOnNonExact: true },
    );

    expect(state.repairQueueUpsertCalls).toHaveLength(0);
  });

  it("enqueues exact-date repair for weekday fallback results", async () => {
    const { client, state } = createSupabaseStub([
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
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 7,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(result.get("sym-1|2026-02-16")).toBe(148);
    expect(state.repairQueueUpsertCalls).toEqual([
      {
        rows: [{ symbol_id: "sym-1", target_date: "2026-02-16" }],
        onConflict: "symbol_id,target_date",
        ignoreDuplicates: true,
      },
    ]);
  });

  it("enqueues exact-date repair for unresolved weekday requests", async () => {
    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueue).toContainEqual({
      symbol_id: "sym-1",
      target_date: "2026-02-16",
      status: "pending",
      created_at: "2026-02-20T12:00:00.000Z",
    });
  });

  it("does not enqueue duplicate exact-date repairs for repeated requests", async () => {
    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueueUpsertCalls[0]?.rows).toEqual([
      { symbol_id: "sym-1", target_date: "2026-02-16" },
    ]);
    expect(state.repairQueue).toHaveLength(1);
  });

  it("does not enqueue weekend repairs for non-crypto symbols", async () => {
    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "sym-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueueUpsertCalls).toHaveLength(0);
  });

  it("enqueues weekend repairs for crypto symbols", async () => {
    const { client, state } = createSupabaseStub([], {
      symbols: [
        {
          id: "crypto-1",
          quote_type: "CRYPTOCURRENCY",
          last_quote_at: "2026-02-14T00:00:00.000Z",
        },
      ],
    });
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "crypto-1",
      canonicalId: "crypto-1",
      providerAlias: "BTC-USD",
    });

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "crypto-1",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueue).toContainEqual({
      symbol_id: "crypto-1",
      target_date: "2026-02-15",
      status: "pending",
      created_at: "2026-02-20T12:00:00.000Z",
    });
  });

  it("throttles stale symbols to one latest-date probe", async () => {
    const { client, state } = createSupabaseStub([], {
      symbols: [
        {
          id: "stale-1",
          quote_type: "EQUITY",
          last_quote_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "stale-1",
      canonicalId: "stale-1",
      providerAlias: "OLD",
    });

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "stale-1",
          date: new Date("2026-02-16T00:00:00.000Z"),
        },
        {
          symbolLookup: "stale-1",
          date: new Date("2026-02-17T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueueUpsertCalls[0]?.rows).toEqual([
      { symbol_id: "stale-1", target_date: "2026-02-17" },
    ]);
  });

  it("does not enqueue another stale-symbol probe during the throttle window", async () => {
    const { client, state } = createSupabaseStub([], {
      symbols: [
        {
          id: "stale-1",
          quote_type: "EQUITY",
          last_quote_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      repairQueue: [
        {
          symbol_id: "stale-1",
          target_date: "2026-02-10",
          status: "non_trading_or_no_exact",
          created_at: "2026-02-18T00:00:00.000Z",
        },
      ],
    });
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "stale-1",
      canonicalId: "stale-1",
      providerAlias: "OLD",
    });

    const { fetchQuotes } = await import("./fetch");

    await fetchQuotes(
      [
        {
          symbolLookup: "stale-1",
          date: new Date("2026-02-17T00:00:00.000Z"),
        },
      ],
      {
        staleGuardDays: 0,
        liveFetchOnMiss: false,
        enqueueExactRepairOnNonExact: true,
      },
    );

    expect(state.repairQueueUpsertCalls).toHaveLength(0);
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

  it("normalizes GBp chart prices before caching and returning", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "BP.L",
      canonicalId: "bp-symbol",
      providerAlias: "BP.L",
      quoteToCurrencyRate: 0.01,
    });
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 524.4,
          adjclose: 523.2,
        },
      ],
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "BP.L",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(result.get("bp-symbol|2026-02-15")).toBeCloseTo(5.244, 10);
    expect(result.get("BP.L|2026-02-15")).toBeCloseTo(5.244, 10);
    expect(state.upsertCalls).toHaveLength(1);

    const row = state.upsertCalls[0]?.rows[0];
    expect(row).toMatchObject({
      symbol_id: "bp-symbol",
      date: "2026-02-14",
    });
    expect(row?.close_price).toBeCloseTo(5.244, 10);
    expect(row?.adjusted_close_price).toBeCloseTo(5.232, 10);
  });

  it("normalizes KWF chart prices before caching and returning", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "NBK.KW",
      canonicalId: "nbk-symbol",
      providerAlias: "NBK.KW",
      quoteToCurrencyRate: 0.001,
    });
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00.000Z"),
          close: 838,
          adjclose: 837,
        },
      ],
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "NBK.KW",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(result.get("nbk-symbol|2026-02-15")).toBeCloseTo(0.838, 10);
    expect(state.upsertCalls).toHaveLength(1);

    const row = state.upsertCalls[0]?.rows[0];
    expect(row).toMatchObject({
      symbol_id: "nbk-symbol",
      date: "2026-02-14",
    });
    expect(row?.close_price).toBeCloseTo(0.838, 10);
    expect(row?.adjusted_close_price).toBeCloseTo(0.837, 10);
  });

  it("normalizes regularMarketPrice fallback before caching and returning", async () => {
    vi.setSystemTime(new Date("2026-02-15T23:00:00.000Z"));

    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);
    mockSymbolResolution({
      lookup: "BP.L",
      canonicalId: "bp-symbol",
      providerAlias: "BP.L",
      quoteToCurrencyRate: 0.01,
    });
    yahooChartMock.mockResolvedValue({
      quotes: [],
      meta: {
        regularMarketPrice: 524.4,
        regularMarketTime: new Date("2026-02-14T00:00:00.000Z"),
      },
    });

    const { fetchQuotes } = await import("./fetch");

    const result = await fetchQuotes(
      [
        {
          symbolLookup: "BP.L",
          date: new Date("2026-02-15T00:00:00.000Z"),
        },
      ],
      { staleGuardDays: 0 },
    );

    expect(result.get("bp-symbol|2026-02-15")).toBeCloseTo(5.244, 10);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]?.rows).toHaveLength(1);

    const row = state.upsertCalls[0]?.rows[0];
    expect(row).toMatchObject({
      symbol_id: "bp-symbol",
      date: "2026-02-14",
    });
    expect(row?.close_price).toBeCloseTo(5.244, 10);
    expect(row?.adjusted_close_price).toBeCloseTo(5.244, 10);
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
        ["sym-1", { canonicalId: "sym-1", quoteToCurrencyRate: 1 }],
        ["sym-2", { canonicalId: "sym-2", quoteToCurrencyRate: 1 }],
        ["sym-3", { canonicalId: "sym-3", quoteToCurrencyRate: 1 }],
      ]),
      byCanonicalId: new Map([
        ["sym-1", { providerAlias: "AAPL", quoteToCurrencyRate: 1 }],
        ["sym-2", { providerAlias: "MSFT", quoteToCurrencyRate: 1 }],
        ["sym-3", { providerAlias: "GOOG", quoteToCurrencyRate: 1 }],
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
