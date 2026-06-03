import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchYahooFinanceSymbolMock, searchYahooFinanceSymbolsMock } =
  vi.hoisted(() => ({
    fetchYahooFinanceSymbolMock: vi.fn(),
    searchYahooFinanceSymbolsMock: vi.fn(),
  }));

vi.mock("./search", () => ({
  fetchYahooFinanceSymbol: fetchYahooFinanceSymbolMock,
  searchYahooFinanceSymbols: searchYahooFinanceSymbolsMock,
}));

describe("validateSymbol", () => {
  beforeEach(() => {
    fetchYahooFinanceSymbolMock.mockReset();
    searchYahooFinanceSymbolsMock.mockReset();
  });

  it("returns normalized ISO currency for UK pence-quoted symbols", async () => {
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        currency: "GBP",
      },
    });

    const { validateSymbol } = await import("./validate");
    const result = await validateSymbol("bp.l");

    expect(result).toEqual({
      valid: true,
      normalized: "BP.L",
      currency: "GBP",
    });
  });

  it("returns normalized ISO currency for Kuwaiti fils-quoted symbols", async () => {
    fetchYahooFinanceSymbolMock.mockResolvedValue({
      success: true,
      data: {
        currency: "KWD",
      },
    });

    const { validateSymbol } = await import("./validate");
    const result = await validateSymbol("nbk.kw");

    expect(result).toEqual({
      valid: true,
      normalized: "NBK.KW",
      currency: "KWD",
    });
  });
});
