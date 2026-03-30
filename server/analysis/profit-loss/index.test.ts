import { beforeEach, describe, expect, it, vi } from "vitest";

import { toCivilDateKey } from "@/lib/date/date-utils";

const {
  calculatePositionUnrealizedProfitLossMock,
  calculatePositionRealizedProfitLossMock,
} = vi.hoisted(() => ({
  calculatePositionUnrealizedProfitLossMock: vi.fn(),
  calculatePositionRealizedProfitLossMock: vi.fn(),
}));

vi.mock("./unrealized", () => ({
  calculatePositionUnrealizedProfitLoss:
    calculatePositionUnrealizedProfitLossMock,
}));

vi.mock("./realized", () => ({
  calculatePositionRealizedProfitLoss: calculatePositionRealizedProfitLossMock,
}));

import { calculatePositionProfitLossSummary } from "./index";

describe("calculatePositionProfitLossSummary", () => {
  beforeEach(() => {
    calculatePositionUnrealizedProfitLossMock.mockReset();
    calculatePositionRealizedProfitLossMock.mockReset();
  });

  it("returns the combined realized and unrealized summary for a position", async () => {
    const asOfDateKey = toCivilDateKey("2026-03-30");

    if (!asOfDateKey) {
      throw new Error("Expected valid CivilDateKey in test");
    }

    calculatePositionUnrealizedProfitLossMock.mockResolvedValue({
      costBasisPerUnit: 100,
      totalCostBasis: 600,
      unrealizedProfitLoss: 210.66,
      unrealizedProfitLossPercentage: 0.3511,
    });
    calculatePositionRealizedProfitLossMock.mockResolvedValue({
      realizedProfitLoss: 519.24,
    });

    const result = await calculatePositionProfitLossSummary(
      "pos-1",
      asOfDateKey,
    );

    expect(result).toEqual({
      costBasisPerUnit: 100,
      totalCostBasis: 600,
      unrealizedProfitLoss: 210.66,
      unrealizedProfitLossPercentage: 0.3511,
      realizedProfitLoss: 519.24,
    });
    expect(calculatePositionUnrealizedProfitLossMock).toHaveBeenCalledWith(
      "pos-1",
      asOfDateKey,
    );
    expect(calculatePositionRealizedProfitLossMock).toHaveBeenCalledWith(
      "pos-1",
    );
  });
});
