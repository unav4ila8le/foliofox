import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserMock,
  fetchYahooFinanceSymbolMock,
  fetchCurrenciesMock,
  setPrimarySymbolAliasMock,
  createServiceClientMock,
  fetchQuotesMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  fetchYahooFinanceSymbolMock: vi.fn(),
  fetchCurrenciesMock: vi.fn(),
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
    upsertRows: [] as Array<Record<string, unknown>>,
  };

  const symbolsApi = {
    upsert(row: Record<string, unknown>) {
      state.upsertRows.push({ ...row });

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
    setPrimarySymbolAliasMock.mockReset();
    createServiceClientMock.mockReset();
    fetchQuotesMock.mockReset();

    getCurrentUserMock.mockResolvedValue({ user: { id: "user-1" } });
    fetchQuotesMock.mockResolvedValue(new Map());
    fetchCurrenciesMock.mockResolvedValue([
      { alphabetic_code: "GBP", name: "Pound Sterling" },
      { alphabetic_code: "KWD", name: "Kuwaiti Dinar" },
    ]);
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
    expect(state.upsertRows).toEqual([
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
    expect(state.upsertRows[0]).toMatchObject({
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
