import { beforeEach, describe, expect, it, vi } from "vitest";

type SymbolRow = {
  id: string;
  ticker: string;
  currency?: string;
  quote_to_currency_rate?: number;
};

type SymbolAliasRow = {
  symbol_id: string;
  value: string;
  type: string;
  source: string;
  is_primary: boolean;
  effective_from: string;
  effective_to: string | null;
};

const { createServiceClientMock, normalizeSymbolMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  normalizeSymbolMock: vi.fn(),
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/server/symbols/validate", () => ({
  normalizeSymbol: normalizeSymbolMock,
}));

function compareValues(
  left: unknown,
  right: unknown,
  options: { ascending: boolean; nullsFirst?: boolean },
): number {
  if (left === right) return 0;

  if (left == null || right == null) {
    const leftIsNull = left == null;
    const nullsFirst = options.nullsFirst ?? false;
    const nullOrder = leftIsNull ? -1 : 1;

    if (nullsFirst) {
      return nullOrder;
    }
    return -nullOrder;
  }

  const comparableLeft = left as string | number | boolean;
  const comparableRight = right as string | number | boolean;

  if (comparableLeft < comparableRight) {
    return options.ascending ? -1 : 1;
  }

  return options.ascending ? 1 : -1;
}

function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  orderClauses: Array<{
    column: keyof T;
    ascending: boolean;
    nullsFirst?: boolean;
  }>,
): T[] {
  const sorted = [...rows];
  sorted.sort((leftRow, rightRow) => {
    for (const order of orderClauses) {
      const comparison = compareValues(
        leftRow[order.column],
        rightRow[order.column],
        {
          ascending: order.ascending,
          nullsFirst: order.nullsFirst,
        },
      );

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });

  return sorted;
}

function createSupabaseStub(data: {
  symbols: SymbolRow[];
  symbolAliases: SymbolAliasRow[];
  symbolError?: string | null;
  symbolAliasesError?: string | null;
}) {
  const state = {
    symbolQueryCount: 0,
    symbolAliasesQueryCount: 0,
  };

  const symbolsApi = {
    select() {
      const inFilters = new Map<string, string[]>();

      return {
        in(column: string, values: string[]) {
          inFilters.set(column, [...values]);
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: {
                data: SymbolRow[] | null;
                error: { message: string } | null;
              }) => TResult1)
            | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          state.symbolQueryCount += 1;

          if (data.symbolError) {
            return Promise.resolve({
              data: null,
              error: { message: data.symbolError },
            }).then(onfulfilled ?? undefined, onrejected);
          }

          let rows = [...data.symbols];
          inFilters.forEach((values, column) => {
            rows = rows.filter((row) => {
              const cell = row[column as keyof SymbolRow];
              return values.includes(String(cell));
            });
          });

          const rowsWithDefaults = rows.map((row) => ({
            currency: "USD",
            quote_to_currency_rate: 1,
            ...row,
          }));

          return Promise.resolve({ data: rowsWithDefaults, error: null }).then(
            onfulfilled ?? undefined,
            onrejected,
          );
        },
      };
    },
  };

  const symbolAliasesApi = {
    select() {
      const eqFilters = new Map<string, unknown>();
      const inFilters = new Map<string, string[]>();
      const isFilters = new Map<string, unknown>();
      const ilikeFilters = new Map<string, string>();
      let limitValue: number | null = null;
      const orderClauses: Array<{
        column: keyof SymbolAliasRow;
        ascending: boolean;
        nullsFirst?: boolean;
      }> = [];

      return {
        eq(column: string, value: unknown) {
          eqFilters.set(column, value);
          return this;
        },
        in(column: string, values: string[]) {
          inFilters.set(column, [...values]);
          return this;
        },
        is(column: string, value: unknown) {
          isFilters.set(column, value);
          return this;
        },
        ilike(column: string, value: string) {
          ilikeFilters.set(column, value);
          return this;
        },
        limit(value: number) {
          limitValue = value;
          return this;
        },
        order(
          column: string,
          options?: { ascending?: boolean; nullsFirst?: boolean },
        ) {
          orderClauses.push({
            column: column as keyof SymbolAliasRow,
            ascending: options?.ascending ?? true,
            nullsFirst: options?.nullsFirst,
          });
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: {
                data: SymbolAliasRow[] | null;
                error: { message: string } | null;
              }) => TResult1)
            | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          state.symbolAliasesQueryCount += 1;

          if (data.symbolAliasesError) {
            return Promise.resolve({
              data: null,
              error: { message: data.symbolAliasesError },
            }).then(onfulfilled ?? undefined, onrejected);
          }

          let rows = [...data.symbolAliases];

          eqFilters.forEach((value, column) => {
            rows = rows.filter(
              (row) => row[column as keyof SymbolAliasRow] === value,
            );
          });

          inFilters.forEach((values, column) => {
            rows = rows.filter((row) => {
              const cell = row[column as keyof SymbolAliasRow];
              return values.includes(String(cell));
            });
          });

          isFilters.forEach((value, column) => {
            rows = rows.filter(
              (row) => row[column as keyof SymbolAliasRow] === value,
            );
          });

          ilikeFilters.forEach((value, column) => {
            const normalizedValue = value.toLowerCase();
            rows = rows.filter((row) => {
              const cell = row[column as keyof SymbolAliasRow];
              return String(cell).toLowerCase() === normalizedValue;
            });
          });

          rows = sortRows(rows, orderClauses);
          if (limitValue !== null) {
            rows = rows.slice(0, limitValue);
          }

          return Promise.resolve({ data: rows, error: null }).then(
            onfulfilled ?? undefined,
            onrejected,
          );
        },
      };
    },
  };

  const client = {
    from(table: string) {
      if (table === "symbols") {
        return symbolsApi;
      }

      if (table === "symbol_aliases") {
        return symbolAliasesApi;
      }

      throw new Error(`Unexpected table "${table}" requested in test.`);
    },
  };

  return { client, state };
}

describe("resolveSymbolsBatch", () => {
  beforeEach(() => {
    vi.resetModules();
    createServiceClientMock.mockReset();
    normalizeSymbolMock.mockReset();

    normalizeSymbolMock.mockImplementation(async (value: string) =>
      value.trim().toUpperCase(),
    );
  });

  it("resolves mixed UUID and alias inputs via batched queries", async () => {
    const symbolIdOne = "11111111-1111-1111-1111-111111111111";
    const symbolIdOneUppercase = symbolIdOne.toUpperCase();
    const symbolIdTwo = "22222222-2222-2222-2222-222222222222";
    const { client, state } = createSupabaseStub({
      symbols: [
        { id: symbolIdOne, ticker: "AAPL" },
        { id: symbolIdTwo, ticker: "MSFT" },
      ],
      symbolAliases: [
        {
          symbol_id: symbolIdOne,
          value: "AAPL",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
        {
          symbol_id: symbolIdTwo,
          value: "MSFT",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch([symbolIdOneUppercase, "msft"]);

    expect(result.byInput.get(symbolIdOneUppercase)).toEqual({
      canonicalId: symbolIdOne,
      providerAlias: "AAPL",
      displayTicker: "AAPL",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(result.byInput.get("msft")).toEqual({
      canonicalId: symbolIdTwo,
      providerAlias: "MSFT",
      displayTicker: "MSFT",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(result.byCanonicalId.get(symbolIdTwo)).toEqual({
      providerAlias: "MSFT",
      displayTicker: "MSFT",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });

    expect(state.symbolQueryCount).toBe(1);
    expect(state.symbolAliasesQueryCount).toBe(3);
  });

  it("falls back to primary alias and ticker when provider alias is missing", async () => {
    const symbolIdPrimaryFallback = "33333333-3333-3333-3333-333333333333";
    const symbolIdTickerFallback = "44444444-4444-4444-4444-444444444444";
    const { client } = createSupabaseStub({
      symbols: [
        { id: symbolIdPrimaryFallback, ticker: "PRI" },
        { id: symbolIdTickerFallback, ticker: "TICKER_ONLY" },
      ],
      symbolAliases: [
        {
          symbol_id: symbolIdPrimaryFallback,
          value: "ALIAS_PRI",
          type: "ticker",
          source: "manual",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(
      ["alias_pri", symbolIdTickerFallback],
      {
        provider: "fmp",
      },
    );

    expect(result.byInput.get("alias_pri")).toEqual({
      canonicalId: symbolIdPrimaryFallback,
      providerAlias: "ALIAS_PRI",
      displayTicker: "ALIAS_PRI",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(result.byInput.get(symbolIdTickerFallback)).toEqual({
      canonicalId: symbolIdTickerFallback,
      providerAlias: "TICKER_ONLY",
      displayTicker: "TICKER_ONLY",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
  });

  it("includes normalized currency and quote-to-currency rate from symbol metadata", async () => {
    const symbolId = "99999999-9999-9999-9999-999999999999";
    const { client } = createSupabaseStub({
      symbols: [
        {
          id: symbolId,
          ticker: "BP.L",
          currency: "GBP",
          quote_to_currency_rate: 0.01,
        },
      ],
      symbolAliases: [
        {
          symbol_id: symbolId,
          value: "BP.L",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(["bp.l"]);

    expect(result.byInput.get("bp.l")).toEqual({
      canonicalId: symbolId,
      providerAlias: "BP.L",
      displayTicker: "BP.L",
      currency: "GBP",
      quoteToCurrencyRate: 0.01,
    });
    expect(result.byCanonicalId.get(symbolId)).toEqual({
      providerAlias: "BP.L",
      displayTicker: "BP.L",
      currency: "GBP",
      quoteToCurrencyRate: 0.01,
    });
  });

  it("resolves aliases with case-insensitive fallback when stored alias casing differs", async () => {
    const symbolId = "88888888-8888-8888-8888-888888888888";
    const { client, state } = createSupabaseStub({
      symbols: [{ id: symbolId, ticker: "MSFT" }],
      symbolAliases: [
        {
          symbol_id: symbolId,
          value: "MsFt",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(["msft"]);

    expect(result.byInput.get("msft")).toEqual({
      canonicalId: symbolId,
      providerAlias: "MsFt",
      displayTicker: "MsFt",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(state.symbolQueryCount).toBe(1);
    expect(state.symbolAliasesQueryCount).toBe(4);
  });

  it("keeps partial results and warns for unresolved inputs when onError=warn", async () => {
    const symbolId = "55555555-5555-5555-5555-555555555555";
    const { client } = createSupabaseStub({
      symbols: [{ id: symbolId, ticker: "VALID" }],
      symbolAliases: [
        {
          symbol_id: symbolId,
          value: "VALID",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(["valid", "missing"], {
      onError: "warn",
    });

    expect(result.byInput.get("valid")).toEqual({
      canonicalId: symbolId,
      providerAlias: "VALID",
      displayTicker: "VALID",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(result.byInput.has("missing")).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Unable to resolve symbol identifier "missing" to a canonical symbol.',
    );

    consoleWarnSpy.mockRestore();
  });

  it("throws when unresolved inputs are provided and onError=throw", async () => {
    const { client } = createSupabaseStub({
      symbols: [],
      symbolAliases: [],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    await expect(resolveSymbolsBatch(["missing"])).rejects.toThrow(
      'Unable to resolve symbol identifier "missing" to a canonical symbol.',
    );
  });

  it("skips unresolved inputs without warnings when onError=skip", async () => {
    const symbolId = "66666666-6666-6666-6666-666666666666";
    const { client } = createSupabaseStub({
      symbols: [{ id: symbolId, ticker: "VALID" }],
      symbolAliases: [
        {
          symbol_id: symbolId,
          value: "VALID",
          type: "ticker",
          source: "yahoo",
          is_primary: true,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_to: null,
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(client);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(["valid", "missing"], {
      onError: "skip",
    });

    expect(result.byInput.get("valid")).toEqual({
      canonicalId: symbolId,
      providerAlias: "VALID",
      displayTicker: "VALID",
      currency: "USD",
      quoteToCurrencyRate: 1,
    });
    expect(result.byInput.has("missing")).toBe(false);
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("throws when provider alias fallback chain is empty and onError=throw", async () => {
    const symbolId = "77777777-7777-7777-7777-777777777777";
    const { client } = createSupabaseStub({
      symbols: [{ id: symbolId, ticker: "" }],
      symbolAliases: [],
    });

    createServiceClientMock.mockResolvedValue(client);
    const { resolveSymbolsBatch } = await import("./resolve");

    await expect(resolveSymbolsBatch([symbolId])).rejects.toThrow(
      `Symbol "${symbolId}" is missing a yahoo ticker alias.`,
    );
  });

  it("warns for each input and returns empty maps when batched alias lookup fails", async () => {
    const { client } = createSupabaseStub({
      symbols: [],
      symbolAliases: [],
      symbolAliasesError: "temporary db outage",
    });

    createServiceClientMock.mockResolvedValue(client);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const { resolveSymbolsBatch } = await import("./resolve");

    const result = await resolveSymbolsBatch(["aapl", "msft"], {
      onError: "warn",
    });

    expect(result.byInput.size).toBe(0);
    expect(result.byCanonicalId.size).toBe(0);
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      1,
      'Error resolving symbol "aapl":',
      "Failed to batch resolve symbol aliases: temporary db outage",
    );
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      2,
      'Error resolving symbol "msft":',
      "Failed to batch resolve symbol aliases: temporary db outage",
    );

    consoleWarnSpy.mockRestore();
  });
});

describe("upsertSymbolAlias", () => {
  beforeEach(() => {
    vi.resetModules();
    createServiceClientMock.mockReset();
    normalizeSymbolMock.mockReset();
    normalizeSymbolMock.mockImplementation(async (value: string) =>
      value.trim().toUpperCase(),
    );
  });

  it("refreshes an active alias even when it was saved from another source", async () => {
    const insertMock = vi.fn();
    const existingAlias = {
      id: "alias-1",
      symbol_id: "symbol-1",
      value: "US0000000001",
      type: "isin",
      source: "other_broker",
      is_primary: false,
      effective_from: "2026-01-01T00:00:00.000Z",
      effective_to: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    createServiceClientMock.mockResolvedValue({
      from(table: string) {
        expect(table).toBe("symbol_aliases");
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                expect(column).not.toBe("source");
                expect(["symbol_id", "type", "value"].includes(column)).toBe(
                  true,
                );
                expect(value).toBe(
                  column === "symbol_id"
                    ? "symbol-1"
                    : column === "type"
                      ? "isin"
                      : "US0000000001",
                );
                return this;
              },
              is(column: string, value: unknown) {
                expect(column).toBe("effective_to");
                expect(value).toBeNull();
                return this;
              },
              limit(value: number) {
                expect(value).toBe(1);
                return Promise.resolve({
                  data: [existingAlias],
                  error: null,
                });
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                expect(column).toBe("id");
                expect(value).toBe("alias-1");
                return this;
              },
              select() {
                return this;
              },
              single() {
                return Promise.resolve({
                  data: { ...existingAlias, ...payload },
                  error: null,
                });
              },
            };
          },
          insert: insertMock,
        };
      },
    });

    const { upsertSymbolAlias } = await import("./resolve");
    const result = await upsertSymbolAlias("symbol-1", "US0000000001", {
      source: "trade_republic",
      type: "isin",
    });

    expect(result).toMatchObject({
      id: "alias-1",
      source: "other_broker",
      effective_to: null,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
