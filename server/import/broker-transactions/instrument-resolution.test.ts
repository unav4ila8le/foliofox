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

  it("auto-links an existing same-currency ISIN alias", async () => {
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

    const { resolveBrokerTransactionInstruments } =
      await import("./instrument-resolution");
    const result = await resolveBrokerTransactionInstruments({
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "auto_linked",
      symbolId: "symbol-1",
    });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("US0000000001", {
      type: "isin",
      source: "trade_republic",
    });
    expect(upsertSymbolAliasMock).toHaveBeenCalledWith(
      "symbol-1",
      "US0000000001",
      { source: "trade_republic", type: "isin" },
    );
    expect(searchYahooFinanceSymbolsMock).not.toHaveBeenCalled();
  });

  it("searches providers and persists an ISIN alias for one safe candidate", async () => {
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
    });
    expect(createSymbolMock).toHaveBeenCalledWith("ACME.DE");
    expect(upsertSymbolAliasMock).toHaveBeenCalledWith(
      "symbol-1",
      "US0000000001",
      { source: "trade_republic", type: "isin" },
    );
  });

  it("requires review when candidates do not match the broker currency", async () => {
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
      positions: [basePosition],
      importSource: "trade_republic",
    });

    expect(result.get(basePosition.positionKey)).toMatchObject({
      state: "needs_review",
      warning: expect.stringContaining("none are quoted in EUR"),
    });
    expect(createSymbolMock).not.toHaveBeenCalled();
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
