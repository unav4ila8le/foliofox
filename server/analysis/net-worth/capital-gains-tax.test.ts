import { describe, expect, it } from "vitest";

import { calculateCapitalGainsTaxAmount } from "./capital-gains-tax";

describe("calculateCapitalGainsTaxAmount", () => {
  it("returns 0 for liabilities", () => {
    const result = calculateCapitalGainsTaxAmount({
      positionType: "liability",
      capitalGainsTaxRate: 0.26,
      unrealizedGain: 1000,
    });

    expect(result).toBe(0);
  });

  it("returns 0 when tax rate is null or non-positive", () => {
    expect(
      calculateCapitalGainsTaxAmount({
        positionType: "asset",
        capitalGainsTaxRate: null,
        unrealizedGain: 1000,
      }),
    ).toBe(0);

    expect(
      calculateCapitalGainsTaxAmount({
        positionType: "asset",
        capitalGainsTaxRate: 0,
        unrealizedGain: 1000,
      }),
    ).toBe(0);
  });

  it("returns 0 for zero or negative unrealized gain", () => {
    expect(
      calculateCapitalGainsTaxAmount({
        positionType: "asset",
        capitalGainsTaxRate: 0.26,
        unrealizedGain: 0,
      }),
    ).toBe(0);

    expect(
      calculateCapitalGainsTaxAmount({
        positionType: "asset",
        capitalGainsTaxRate: 0.26,
        unrealizedGain: -500,
      }),
    ).toBe(0);
  });

  it("calculates tax for positive unrealized gains", () => {
    const result = calculateCapitalGainsTaxAmount({
      positionType: "asset",
      capitalGainsTaxRate: 0.26,
      unrealizedGain: 1000,
    });

    expect(result).toBe(260);
  });
});
