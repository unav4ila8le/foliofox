import { describe, expect, it } from "vitest";

import { normalizeProviderQuoteUnit } from "./quote-units";

describe("normalizeProviderQuoteUnit", () => {
  it.each([
    ["GBp", "GBP", 0.01],
    ["GBX", "GBP", 0.01],
    ["KWF", "KWD", 0.001],
  ])("normalizes provider quote unit %s", (quoteCurrency, currency, rate) => {
    const result = normalizeProviderQuoteUnit(quoteCurrency);

    expect(result).toEqual({
      success: true,
      data: {
        quoteCurrency,
        currency,
        quoteToCurrencyRate: rate,
      },
    });
  });

  it("keeps ISO currency codes as major currency units", () => {
    const result = normalizeProviderQuoteUnit("usd");

    expect(result).toEqual({
      success: true,
      data: {
        quoteCurrency: "usd",
        currency: "USD",
        quoteToCurrencyRate: 1,
      },
    });
  });

  it("returns a clear error for unsupported provider quote units", () => {
    const result = normalizeProviderQuoteUnit("XAUOZ");

    expect(result).toEqual({
      success: false,
      code: "UNSUPPORTED_QUOTE_UNIT",
      message: 'Unsupported provider quote currency "XAUOZ".',
    });
  });
});
