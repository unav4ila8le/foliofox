import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BrokerTransactionPositionDraft } from "@/lib/import/broker-transactions/types";

const createSymbolMock = vi.fn();
const resolveSymbolInputMock = vi.fn();
const upsertSymbolAliasMock = vi.fn();
const searchYahooFinanceSymbolsMock = vi.fn();
const fetchYahooFinanceSymbolMock = vi.fn();

vi.mock("@/server/symbols/create", () => ({
  createSymbol: createSymbolMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolInput: resolveSymbolInputMock,
  upsertSymbolAlias: upsertSymbolAliasMock,
}));

vi.mock("@/server/symbols/search", () => ({
  searchYahooFinanceSymbols: searchYahooFinanceSymbolsMock,
  fetchYahooFinanceSymbol: fetchYahooFinanceSymbolMock,
}));

const basePosition: BrokerTransactionPositionDraft = {
  positionKey: "trade_republic:US0000000001:Acme",
  name: "Acme",
  category_id: "equity",
  currency: "EUR",
  brokerSymbol: "US0000000001",
  earliestTradeDate: "2024-01-01",
  firstUnitValue: 10,
  endingQuantity: 2,
};

describe("broker instrument resolution", () => {
  beforeEach(() => {
    createSymbolMock.mockReset();
    resolveSymbolInputMock.mockReset();
    upsertSymbolAliasMock.mockReset();
    searchYahooFinanceSymbolsMock.mockReset();
    fetchYahooFinanceSymbolMock.mockReset();
  });

  it("auto-links an existing ISIN alias when it is the only candidate", async () => {
    resolveSymbolInputMock.mockResolvedValue({
      symbol: {
        id: "symbol-1",
        ticker: "ACME.DE",
        currency: "EUR",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
      },
    });
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME.DE" }],
    });
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME.DE",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
        quote_type: "EQUITY",
        currency: "EUR",
      },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
      selectedTicker: "ACME.DE",
    });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("US0000000001", {
      type: "isin",
      source: "trade_republic",
      activeOnly: true,
    });
    expect(upsertSymbolAliasMock).toHaveBeenCalledWith(
      "symbol-1",
      "US0000000001",
      { source: "trade_republic", type: "isin" },
    );
    expect(searchYahooFinanceSymbolsMock).toHaveBeenCalled();
  });

  it("auto-links a single provider ISIN candidate", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME.DE" }],
    });
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME.DE",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
        quote_type: "EQUITY",
        currency: "EUR",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
      selectedTicker: "ACME.DE",
    });
    expect(createSymbolMock).toHaveBeenCalledWith("ACME.DE");
    expect(upsertSymbolAliasMock).toHaveBeenCalledWith(
      "symbol-1",
      "US0000000001",
      { source: "trade_republic", type: "isin" },
    );
  });

  it("auto-links a single cross-currency ISIN candidate for FX conversion", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME" }],
    });
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "NYQ",
        quote_type: "EQUITY",
        currency: "USD",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
      selectedTicker: "ACME",
      warning: expect.stringContaining("converted from EUR to USD"),
    });
  });

  it("requires review when an ISIN has one matching-currency candidate plus other currencies", async () => {
    resolveSymbolInputMock.mockResolvedValue({
      symbol: {
        id: "symbol-1",
        ticker: "ACME.DE",
        currency: "EUR",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
      },
    });
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME.DE" }, { id: "ACME.MI" }],
    });
    fetchYahooFinanceSymbolMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          ticker: "ACME.DE",
          long_name: "Acme",
          short_name: "Acme",
          exchange: "GER",
          quote_type: "EQUITY",
          currency: "EUR",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ticker: "ACME",
          long_name: "Acme",
          short_name: "Acme",
          exchange: "NYQ",
          quote_type: "EQUITY",
          currency: "USD",
        },
      });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "needs_review",
      candidates: [
        expect.objectContaining({ ticker: "ACME.DE" }),
        expect.objectContaining({ ticker: "ACME" }),
      ],
      warning: expect.stringContaining("one ISIN can trade"),
    });
    expect(createSymbolMock).not.toHaveBeenCalled();
    expect(upsertSymbolAliasMock).not.toHaveBeenCalled();
  });

  it("requires review when an ISIN has multiple matching-currency candidates", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME.DE" }, { id: "ACME.MI" }],
    });
    fetchYahooFinanceSymbolMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          ticker: "ACME.DE",
          long_name: "Acme",
          short_name: "Acme",
          exchange: "GER",
          quote_type: "EQUITY",
          currency: "EUR",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ticker: "ACME.MI",
          long_name: "Acme",
          short_name: "Acme",
          exchange: "MIL",
          quote_type: "EQUITY",
          currency: "EUR",
        },
      });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "needs_review",
      candidates: [
        expect.objectContaining({ ticker: "ACME.DE" }),
        expect.objectContaining({ ticker: "ACME.MI" }),
      ],
      warning: expect.stringContaining("one ISIN can trade"),
    });
    expect(createSymbolMock).not.toHaveBeenCalled();
    expect(upsertSymbolAliasMock).not.toHaveBeenCalled();
  });

  it("requires review when candidates do not match the broker currency", async () => {
    const tickerPosition: BrokerTransactionPositionDraft = {
      ...basePosition,
      positionKey: "trade_republic:acme:acme",
      brokerSymbol: "ACME",
    };
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [{ id: "ACME" }],
    });
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "NYQ",
        quote_type: "EQUITY",
        currency: "USD",
      },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [tickerPosition],
      importSource: "trade_republic",
    });

    expect(result.get(tickerPosition.positionKey)).toMatchObject({
      state: "needs_review",
      warning: expect.stringContaining("none are quoted in EUR"),
    });
    expect(createSymbolMock).not.toHaveBeenCalled();
  });

  it("links broker tickers only through active Yahoo aliases", async () => {
    const tickerPosition: BrokerTransactionPositionDraft = {
      ...basePosition,
      positionKey: "trade_republic:acme:acme",
      brokerSymbol: "ACME",
      currency: "USD",
    };
    resolveSymbolInputMock.mockResolvedValue({
      symbol: {
        id: "symbol-active",
        ticker: "ACME",
        currency: "USD",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "NYQ",
      },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [tickerPosition],
      importSource: "trade_republic",
    });

    expect(result.get(tickerPosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-active",
      selectedTicker: "ACME",
    });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("ACME", {
      type: "ticker",
      source: "yahoo",
      activeOnly: true,
    });
    expect(searchYahooFinanceSymbolsMock).not.toHaveBeenCalled();
  });

  it("accepts a user-selected different-currency symbol for FX conversion", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "NYQ",
        quote_type: "EQUITY",
        currency: "USD",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
      selectedSymbolTickers: {
        [basePosition.positionKey]: "ACME",
      },
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
      selectedTicker: "ACME",
      warning: expect.stringContaining("converted from EUR to USD"),
    });
  });

  it("filters non-security quote types out of fuzzy name-search results", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockImplementation(
      async ({ query }: { query: string }) =>
        query === "US0000000001"
          ? { success: true, data: [{ id: "ACME.DE", typeDisp: "ETF" }] }
          : {
              success: true,
              data: [
                { id: "ALI=F", typeDisp: "Futures" },
                { id: "EURUSD=X", typeDisp: "Currency" },
              ],
            },
    );
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME.DE",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
        quote_type: "ETF",
        currency: "EUR",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    // Name-search junk never becomes a candidate, so the single ISIN match
    // auto-links and the junk tickers are never fetched.
    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      selectedTicker: "ACME.DE",
    });
    expect(fetchYahooFinanceSymbolMock).toHaveBeenCalledTimes(1);
    expect(fetchYahooFinanceSymbolMock).toHaveBeenCalledWith("ACME.DE");
  });

  it("honors a user-selected ticker when the broker row has no symbol", async () => {
    const noSymbolPosition: BrokerTransactionPositionDraft = {
      ...basePosition,
      positionKey: "trade_republic::acme",
      brokerSymbol: null,
    };
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "ACME.DE",
        long_name: "Acme",
        short_name: "Acme",
        exchange: "GER",
        quote_type: "EQUITY",
        currency: "EUR",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [noSymbolPosition],
      importSource: "trade_republic",
      selectedSymbolTickers: {
        [noSymbolPosition.positionKey]: "ACME.DE",
      },
    });

    expect(result.get(noSymbolPosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
      selectedTicker: "ACME.DE",
    });
    // No broker symbol means there is no ISIN alias to persist.
    expect(upsertSymbolAliasMock).not.toHaveBeenCalled();
  });

  it("keeps mutual fund name-search results as candidates", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockImplementation(
      async ({ query }: { query: string }) =>
        query === "US0000000001"
          ? { success: true, data: [] }
          : {
              success: true,
              data: [{ id: "FUNDX", typeDisp: "Mutual Fund" }],
            },
    );
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        ticker: "FUNDX",
        long_name: "Fund X",
        short_name: "Fund X",
        exchange: "NAS",
        quote_type: "MUTUALFUND",
        currency: "EUR",
      },
    });
    createSymbolMock.mockResolvedValue({
      success: true,
      data: { id: "symbol-1" },
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      selectedTicker: "FUNDX",
    });
  });

  it("returns unresolved when no usable candidates are found", async () => {
    resolveSymbolInputMock.mockResolvedValue(null);
    searchYahooFinanceSymbolsMock.mockResolvedValue({
      success: true,
      data: [],
    });

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "unresolved",
      warning: expect.stringContaining("No market symbol candidates"),
    });
    expect(createSymbolMock).not.toHaveBeenCalled();
  });
});
