import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserMock,
  fetchYahooFinanceSymbolMock,
  fetchCurrenciesMock,
  resolveSymbolInputMock,
  setPrimarySymbolAliasMock,
  createServiceClientMock,
  fetchQuotesMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  fetchYahooFinanceSymbolMock: vi.fn(),
  fetchCurrenciesMock: vi.fn(),
  resolveSymbolInputMock: vi.fn(),
  setPrimarySymbolAliasMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  fetchQuotesMock: vi.fn(),
}));

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/server/symbols/search", () => ({
  fetchYahooFinanceSymbol: fetchYahooFinanceSymbolMock,
}));

vi.mock("@/server/currencies/fetch", () => ({
  fetchCurrencies: fetchCurrenciesMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolInput: resolveSymbolInputMock,
  setPrimarySymbolAlias: setPrimarySymbolAliasMock,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchQuotes: fetchQuotesMock,
}));

function createSupabaseStub() {
  const state = {
    insertRows: [] as Array<Record<string, unknown>>,
    updateRows: [] as Array<Record<string, unknown>>,
    updatedIds: [] as string[],
  };

  const symbolsApi = {
    insert(row: Record<string, unknown>) {
      state.insertRows.push({ ...row });
      return {
        select() {
          return {
            async single() {
              return {
                data: {
                  id: "symbol-1",
                  ...row,
                },
                error: null,
              };
            },
          };
        },
      };
    },
    update(row: Record<string, unknown>) {
      state.updateRows.push({ ...row });
      return {
        eq(column: string, value: string) {
          expect(column).toBe("id");
          state.updatedIds.push(value);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: { id: value, ...row },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    state,
    client: {
      from(table: string) {
        if (table !== "symbols") {
          throw new Error(`Unexpected table "${table}"`);
        }

        return symbolsApi;
      },
    },
  };
}

describe("createSymbol", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    fetchYahooFinanceSymbolMock.mockReset();
    fetchCurrenciesMock.mockReset();
    resolveSymbolInputMock.mockReset();
    setPrimarySymbolAliasMock.mockReset();
    createServiceClientMock.mockReset();
    fetchQuotesMock.mockReset();

    getCurrentUserMock.mockResolvedValue({ user: { id: "user-1" } });
    fetchQuotesMock.mockResolvedValue(new Map());
    fetchCurrenciesMock.mockResolvedValue([
      { alphabetic_code: "GBP", name: "Pound Sterling" },
      { alphabetic_code: "KWD", name: "Kuwaiti Dinar" },
    ]);
    resolveSymbolInputMock.mockResolvedValue(null);
    setPrimarySymbolAliasMock.mockResolvedValue({});
  });

  it("accepts a symbol whose Yahoo quote unit normalizes to supported GBP", async () => {
    const { client, state } = createSupabaseStub();
    createServiceClientMock.mockReturnValue(client);
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "BP.L",
        quote_type: "EQUITY",
        short_name: "BP p.l.c.",
        long_name: "BP p.l.c.",
        currency: "GBP",
        quote_currency: "GBp",
        quote_to_currency_rate: 0.01,
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated",
      },
    });

    const { createSymbol } = await import("./create");
    const result = await createSymbol("BP.L");

    expect(result.success).toBe(true);
    expect(fetchQuotesMock).toHaveBeenCalledWith(
      [{ symbolLookup: "symbol-1", date: expect.any(Date) }],
      { upsert: true },
    );
    expect(state.insertRows).toEqual([
      {
        ticker: "BP.L",
        quote_type: "EQUITY",
        short_name: "BP p.l.c.",
        long_name: "BP p.l.c.",
        currency: "GBP",
        quote_currency: "GBp",
        quote_to_currency_rate: 0.01,
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated",
      },
    ]);
  });

  it("refreshes the symbol behind an existing active Yahoo alias", async () => {
    const { client, state } = createSupabaseStub();
    createServiceClientMock.mockReturnValue(client);
    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "symbol-existing" },
    });
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "BP.L",
        quote_type: "EQUITY",
        short_name: "BP p.l.c.",
        long_name: "BP p.l.c.",
        currency: "GBP",
        quote_currency: "GBp",
        quote_to_currency_rate: 0.01,
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated",
      },
    });

    const { createSymbol } = await import("./create");
    const result = await createSymbol("BP.L");

    expect(result).toMatchObject({
      success: true,
      data: { id: "symbol-existing" },
    });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("BP.L", {
      source: "yahoo",
      type: "ticker",
      activeOnly: true,
    });
    expect(state.updatedIds).toEqual(["symbol-existing"]);
    expect(state.updateRows).toHaveLength(1);
    expect(state.insertRows).toEqual([]);
    expect(setPrimarySymbolAliasMock).toHaveBeenCalledWith(
      "symbol-existing",
      "BP.L",
      { source: "yahoo", type: "ticker" },
    );
  });

  it("creates a fresh UUID when the matching Yahoo alias is retired", async () => {
    const { client, state } = createSupabaseStub();
    createServiceClientMock.mockReturnValue(client);
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "REUSED",
        quote_type: "EQUITY",
        short_name: "New issuer",
        long_name: "New issuer",
        currency: "GBP",
        quote_currency: "GBP",
        quote_to_currency_rate: 1,
        exchange: "LSE",
        sector: null,
        industry: null,
      },
    });

    const { createSymbol } = await import("./create");
    const result = await createSymbol("REUSED");

    expect(result).toMatchObject({ success: true, data: { id: "symbol-1" } });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("REUSED", {
      source: "yahoo",
      type: "ticker",
      activeOnly: true,
    });
    expect(state.insertRows).toHaveLength(1);
    expect(state.updateRows).toEqual([]);
    expect(setPrimarySymbolAliasMock).toHaveBeenCalledWith(
      "symbol-1",
      "REUSED",
      { source: "yahoo", type: "ticker" },
    );
  });

  it("accepts a symbol whose Yahoo quote unit normalizes to supported KWD", async () => {
    const { client, state } = createSupabaseStub();
    createServiceClientMock.mockReturnValue(client);
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "NBK.KW",
        quote_type: "EQUITY",
        short_name: "NBK",
        long_name: "National Bank of Kuwait",
        currency: "KWD",
        quote_currency: "KWF",
        quote_to_currency_rate: 0.001,
        exchange: "Kuwait",
        sector: null,
        industry: null,
      },
    });

    const { createSymbol } = await import("./create");
    const result = await createSymbol("NBK.KW");

    expect(result.success).toBe(true);
    expect(state.insertRows[0]).toMatchObject({
      ticker: "NBK.KW",
      currency: "KWD",
      quote_currency: "KWF",
      quote_to_currency_rate: 0.001,
    });
  });

  it("still succeeds when the quote cache warm-up fails", async () => {
    const { client } = createSupabaseStub();
    createServiceClientMock.mockReturnValue(client);
    fetchQuotesMock.mockRejectedValue(new Error("provider down"));
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "BP.L",
        quote_type: "EQUITY",
        short_name: "BP p.l.c.",
        long_name: "BP p.l.c.",
        currency: "GBP",
        quote_currency: "GBp",
        quote_to_currency_rate: 0.01,
        exchange: "LSE",
        sector: "Energy",
        industry: "Oil & Gas Integrated",
      },
    });

    const { createSymbol } = await import("./create");
    const result = await createSymbol("BP.L");

    expect(result.success).toBe(true);
  });
});
