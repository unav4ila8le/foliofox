import { beforeEach, describe, expect, it, vi } from "vitest";

type RepairQueueRow = {
  id: string;
  symbol_id: string;
  target_date: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  claimed_at: string | null;
  last_error: string | null;
  created_at: string;
};

type SymbolRow = {
  id: string;
  ticker: string;
  quote_to_currency_rate: number | null;
  last_quote_at: string | null;
};

type QuoteRow = {
  symbol_id: string;
  date: string;
  close_price: number;
  adjusted_close_price: number;
};

const yahooChartMock = vi.fn();

vi.mock("@/server/yahoo-finance/client", () => ({
  yahooFinance: {
    chart: yahooChartMock,
  },
}));

function projectRow<T extends Record<string, unknown>>(
  row: T,
  columns: string,
) {
  const requestedColumns = columns.split(",").map((column) => column.trim());
  return Object.fromEntries(
    requestedColumns.map((column) => [column, row[column]]),
  );
}

function createFilterMatcher(filters: {
  eq: Array<{ column: string; value: unknown }>;
  in: Array<{ column: string; values: unknown[] }>;
  lte: Array<{ column: string; value: string }>;
}) {
  return (row: Record<string, unknown>) => {
    const eqMatches = filters.eq.every(
      (filter) => row[filter.column] === filter.value,
    );
    const inMatches = filters.in.every((filter) =>
      filter.values.includes(row[filter.column]),
    );
    const lteMatches = filters.lte.every((filter) => {
      const value = row[filter.column];
      return typeof value === "string" && value <= filter.value;
    });

    return eqMatches && inMatches && lteMatches;
  };
}

function createSupabaseStub(options?: {
  queue?: RepairQueueRow[];
  symbols?: SymbolRow[];
  quotes?: QuoteRow[];
}) {
  const state = {
    queue: options?.queue ?? [],
    symbols: options?.symbols ?? [
      {
        id: "sym-1",
        ticker: "AAPL",
        quote_to_currency_rate: 1,
        last_quote_at: null,
      },
    ],
    quotes: options?.quotes ?? [],
  };

  const queueApi = {
    select(columns: string) {
      const filters = {
        eq: [] as Array<{ column: string; value: unknown }>,
        in: [] as Array<{ column: string; values: unknown[] }>,
        lte: [] as Array<{ column: string; value: string }>,
      };
      let limitValue: number | null = null;

      const query = {
        eq(column: string, value: unknown) {
          filters.eq.push({ column, value });
          return this;
        },
        in(column: string, values: unknown[]) {
          filters.in.push({ column, values });
          return this;
        },
        lte(column: string, value: string) {
          filters.lte.push({ column, value });
          return this;
        },
        order() {
          return this;
        },
        limit(value: number) {
          limitValue = value;
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            ((value: { data: unknown[]; error: null }) => TResult1) | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const matches = state.queue.filter(createFilterMatcher(filters));
          const limited =
            limitValue === null ? matches : matches.slice(0, limitValue);
          const data = limited.map((row) =>
            projectRow(row as unknown as Record<string, unknown>, columns),
          );

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };

      return query;
    },
    update(patch: Partial<RepairQueueRow>) {
      const filters = {
        eq: [] as Array<{ column: string; value: unknown }>,
        in: [] as Array<{ column: string; values: unknown[] }>,
        lte: [] as Array<{ column: string; value: string }>,
      };
      let selectColumns: string | null = null;

      const query = {
        eq(column: string, value: unknown) {
          filters.eq.push({ column, value });
          return this;
        },
        in(column: string, values: unknown[]) {
          filters.in.push({ column, values });
          return this;
        },
        lte(column: string, value: string) {
          filters.lte.push({ column, value });
          return this;
        },
        select(columns: string) {
          selectColumns = columns;
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: { data: unknown[] | null; error: null }) => TResult1)
            | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const matches = state.queue.filter(createFilterMatcher(filters));
          matches.forEach((row) => {
            Object.assign(row, patch);
          });

          const selectedColumns = selectColumns;
          const data =
            selectedColumns === null
              ? null
              : matches.map((row) =>
                  projectRow(
                    row as unknown as Record<string, unknown>,
                    selectedColumns,
                  ),
                );

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };

      return query;
    },
  };

  const quotesApi = {
    select(columns: string) {
      let symbolId: string | null = null;
      let dateKeys: string[] = [];

      return {
        eq(column: string, value: string) {
          if (column === "symbol_id") {
            symbolId = value;
          }
          return this;
        },
        in(column: string, values: string[]) {
          if (column === "date") {
            dateKeys = values;
          }
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            ((value: { data: unknown[]; error: null }) => TResult1) | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const data = state.quotes
            .filter(
              (row) =>
                row.symbol_id === symbolId && dateKeys.includes(row.date),
            )
            .map((row) =>
              projectRow(row as unknown as Record<string, unknown>, columns),
            );

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
    },
    async upsert(rows: QuoteRow[]) {
      rows.forEach((row) => {
        const existingIndex = state.quotes.findIndex(
          (quote) =>
            quote.symbol_id === row.symbol_id && quote.date === row.date,
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
    select(columns: string) {
      let symbolIds: string[] = [];

      return {
        in(column: string, values: string[]) {
          if (column === "id") {
            symbolIds = values;
          }
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            ((value: { data: unknown[]; error: null }) => TResult1) | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          const data = state.symbols
            .filter((symbol) => symbolIds.includes(symbol.id))
            .map((symbol) =>
              projectRow(symbol as unknown as Record<string, unknown>, columns),
            );

          return Promise.resolve({ data, error: null }).then(
            onfulfilled,
            onrejected,
          );
        },
      };
    },
    update(patch: Partial<SymbolRow>) {
      let symbolId: string | null = null;

      return {
        eq(column: string, value: string) {
          if (column === "id") {
            symbolId = value;
          }
          return this;
        },
        async or() {
          const symbol = state.symbols.find((row) => row.id === symbolId);
          if (symbol && patch.last_quote_at) {
            symbol.last_quote_at = patch.last_quote_at;
          }
          return { error: null };
        },
      };
    },
  };

  const client = {
    from(table: string) {
      if (table === "quote_repair_queue") return queueApi;
      if (table === "quotes") return quotesApi;
      if (table === "symbols") return symbolsApi;
      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client, state };
}

function createQueueRow(
  overrides: Partial<RepairQueueRow> = {},
): RepairQueueRow {
  return {
    id: "job-1",
    symbol_id: "sym-1",
    target_date: "2026-02-16",
    status: "pending",
    attempt_count: 0,
    next_attempt_at: "2026-02-20T11:00:00.000Z",
    claimed_at: null,
    last_error: null,
    created_at: "2026-02-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("runQuoteRepairQueue", () => {
  beforeEach(() => {
    yahooChartMock.mockReset();
  });

  it("returns zero-work stats when no jobs are due", async () => {
    const { client } = createSupabaseStub({
      queue: [
        createQueueRow({
          next_attempt_at: "2026-02-20T13:00:00.000Z",
        }),
      ],
    });

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result).toEqual({
      success: true,
      message: "No quote repair jobs were due",
      stats: {
        claimedJobs: 0,
        resolvedExact: 0,
        nonTradingOrNoExact: 0,
        retriesScheduled: 0,
        terminalFailures: 0,
        skippedMissingSymbol: 0,
        quoteRowsUpserted: 0,
        symbolHealthUpdates: 0,
      },
    });
    expect(yahooChartMock).not.toHaveBeenCalled();
  });

  it("upserts exact provider rows and marks jobs resolved", async () => {
    const { client, state } = createSupabaseStub({
      queue: [createQueueRow()],
    });
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-16T00:00:00.000Z"),
          close: 100,
          adjclose: 99,
        },
      ],
    });

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result.stats).toMatchObject({
      claimedJobs: 1,
      resolvedExact: 1,
      nonTradingOrNoExact: 0,
      quoteRowsUpserted: 1,
      symbolHealthUpdates: 1,
    });
    expect(state.quotes).toEqual([
      {
        symbol_id: "sym-1",
        date: "2026-02-16",
        close_price: 100,
        adjusted_close_price: 99,
      },
    ]);
    expect(state.queue[0]).toMatchObject({
      status: "resolved_exact",
      attempt_count: 1,
      claimed_at: null,
      last_error: null,
    });
    expect(state.symbols[0]?.last_quote_at).toBe("2026-02-16T00:00:00.000Z");
    expect(yahooChartMock).toHaveBeenCalledWith("AAPL", {
      period1: new Date("2026-02-09T00:00:00.000Z"),
      period2: new Date("2026-02-17T00:00:00.000Z"),
      interval: "1d",
    });
  });

  it("marks provider successes without an exact row as no-exact outcomes", async () => {
    const { client, state } = createSupabaseStub({
      queue: [createQueueRow()],
    });
    yahooChartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date("2026-02-13T00:00:00.000Z"),
          close: 98,
          adjclose: 97,
        },
      ],
    });

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result.stats).toMatchObject({
      claimedJobs: 1,
      resolvedExact: 0,
      nonTradingOrNoExact: 1,
      quoteRowsUpserted: 1,
    });
    expect(state.queue[0]).toMatchObject({
      status: "non_trading_or_no_exact",
      attempt_count: 1,
      claimed_at: null,
    });
  });

  it("resolves jobs from an existing exact quote without calling Yahoo", async () => {
    const { client, state } = createSupabaseStub({
      queue: [createQueueRow()],
      quotes: [
        {
          symbol_id: "sym-1",
          date: "2026-02-16",
          close_price: 101,
          adjusted_close_price: 101,
        },
      ],
    });

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result.stats.resolvedExact).toBe(1);
    expect(state.queue[0]).toMatchObject({
      status: "resolved_exact",
      attempt_count: 1,
    });
    expect(yahooChartMock).not.toHaveBeenCalled();
  });

  it("schedules a retry for transient provider failures", async () => {
    const { client, state } = createSupabaseStub({
      queue: [createQueueRow()],
    });
    yahooChartMock.mockRejectedValue(new Error("502 bad gateway"));

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result.stats).toMatchObject({
      claimedJobs: 1,
      retriesScheduled: 1,
      terminalFailures: 0,
    });
    expect(state.queue[0]).toMatchObject({
      status: "pending",
      attempt_count: 1,
      next_attempt_at: "2026-02-20T12:15:00.000Z",
      claimed_at: null,
      last_error: "502 bad gateway",
    });
  });

  it("marks final provider failures terminal", async () => {
    const { client, state } = createSupabaseStub({
      queue: [createQueueRow({ attempt_count: 4 })],
    });
    yahooChartMock.mockRejectedValue(new Error("502 bad gateway"));

    const { runQuoteRepairQueue } = await import("./repair-worker");
    const result = await runQuoteRepairQueue({
      supabase: client as never,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(result.stats).toMatchObject({
      claimedJobs: 1,
      retriesScheduled: 0,
      terminalFailures: 1,
    });
    expect(state.queue[0]).toMatchObject({
      status: "terminal_error",
      attempt_count: 5,
      claimed_at: null,
      last_error: "502 bad gateway",
    });
  });
});
