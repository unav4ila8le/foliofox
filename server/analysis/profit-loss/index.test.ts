import { beforeEach, describe, expect, it, vi } from "vitest";

import { toCivilDateKey } from "@/lib/date/date-utils";
import type {
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

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
      costBasis: {
        perUnit: 100,
        total: 600,
      },
      unrealized: {
        amount: 210.66,
        percentage: 0.3511,
      },
    });
    calculatePositionRealizedProfitLossMock.mockResolvedValue({
      realized: {
        amount: 519.24,
      },
    });

    const result = await calculatePositionProfitLossSummary(
      "pos-1",
      asOfDateKey,
    );

    expect(result).toEqual({
      costBasis: {
        perUnit: 100,
        total: 600,
      },
      unrealized: {
        amount: 210.66,
        percentage: 0.3511,
      },
      realized: {
        amount: 519.24,
      },
    });
    expect(calculatePositionUnrealizedProfitLossMock).toHaveBeenCalledWith(
      "pos-1",
      asOfDateKey,
    );
    expect(calculatePositionRealizedProfitLossMock).toHaveBeenCalledWith(
      "pos-1",
    );
  });

  it("reuses prefetched position data for the unrealized summary path", async () => {
    const asOfDateKey = toCivilDateKey("2026-03-30");

    if (!asOfDateKey) {
      throw new Error("Expected valid CivilDateKey in test");
    }

    const positionData = {
      position: { id: "pos-1" } as TransformedPosition,
      snapshots: [] as PositionSnapshot[],
    };

    calculatePositionUnrealizedProfitLossMock.mockResolvedValue({
      costBasis: {
        perUnit: 95,
        total: 570,
      },
      unrealized: {
        amount: 30,
        percentage: 0.0526,
      },
    });
    calculatePositionRealizedProfitLossMock.mockResolvedValue({
      realized: {
        amount: 120,
      },
    });

    await calculatePositionProfitLossSummary("pos-1", asOfDateKey, {
      positionData,
    });

    expect(calculatePositionUnrealizedProfitLossMock).toHaveBeenCalledWith(
      "pos-1",
      asOfDateKey,
      { positionData },
    );
  });
});
