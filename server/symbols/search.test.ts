import { beforeEach, describe, expect, it, vi } from "vitest";

const { quoteSummaryMock } = vi.hoisted(() => ({
  quoteSummaryMock: vi.fn(),
}));

vi.mock("@/server/yahoo-finance/client", () => ({
  yahooFinance: {
    quoteSummary: quoteSummaryMock,
  },
}));

describe("fetchYahooFinanceSymbol", () => {
  beforeEach(() => {
    quoteSummaryMock.mockReset();
  });

  it("normalizes UK pence quote units into GBP symbol currency", async () => {
    quoteSummaryMock.mockResolvedValue({
      price: {
        quoteType: "EQUITY",
        shortName: "BP p.l.c.",
        longName: "BP p.l.c.",
        currency: "GBp",
        exchangeName: "LSE",
      },
      assetProfile: {
        sector: "Energy",
        industry: "Oil & Gas Integrated",
      },
    });

    const { fetchYahooFinanceSymbol } = await import("./search");
    const result = await fetchYahooFinanceSymbol("bp.l");

    expect(result).toEqual({
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
  });

  it("normalizes Kuwaiti fils quote units into KWD symbol currency", async () => {
    quoteSummaryMock.mockResolvedValue({
      price: {
        quoteType: "EQUITY",
        shortName: "NBK",
        longName: "National Bank of Kuwait",
        currency: "KWF",
        exchangeName: "Kuwait",
      },
      assetProfile: {},
    });

    const { fetchYahooFinanceSymbol } = await import("./search");
    const result = await fetchYahooFinanceSymbol("nbk.kw");

    expect(result).toEqual({
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
  });
});
