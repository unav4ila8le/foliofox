import { beforeEach, describe, expect, it, vi } from "vitest";

const calculateNetWorthMock = vi.fn();
const fetchPositionsMock = vi.fn();
const calculateProjectedIncomeMock = vi.fn();
const getTopMoversMock = vi.fn();

vi.mock("@/server/analysis/net-worth/net-worth", () => ({
  calculateNetWorth: calculateNetWorthMock,
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: fetchPositionsMock,
}));

vi.mock("@/server/analysis/projected-income/portfolio", () => ({
  calculateProjectedIncome: calculateProjectedIncomeMock,
}));

vi.mock("@/server/ai/tools/top-movers", () => ({
  getTopMovers: getTopMoversMock,
}));

describe("buildAutomatedEmailDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("skips digest generation when the user has no active asset positions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    fetchPositionsMock.mockResolvedValue([]);

    const { buildAutomatedEmailDigest } = await import("./digest");
    const result = await buildAutomatedEmailDigest({
      profile: {
        user_id: "user-1",
        display_currency: "USD",
        time_zone: "UTC",
      },
    });

    expect(result).toEqual({
      eligible: false,
      reason: "no_active_positions",
    });
    expect(calculateNetWorthMock).not.toHaveBeenCalled();
    expect(getTopMoversMock).not.toHaveBeenCalled();
    expect(calculateProjectedIncomeMock).not.toHaveBeenCalled();
  });

  it("builds a digest from the shared analytics helpers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    fetchPositionsMock.mockResolvedValue([{ id: "position-1" }]);
    calculateNetWorthMock
      .mockResolvedValueOnce(1100)
      .mockResolvedValueOnce(1000);
    getTopMoversMock.mockResolvedValue({
      analyzed: 2,
      topByPct: {
        gainers: [{ positionId: "position-1", changePct: 10 }],
        losers: [{ positionId: "position-2", changePct: -5 }],
      },
    });
    calculateProjectedIncomeMock.mockResolvedValue({
      success: true,
      currency: "USD",
      data: [
        { date: new Date(Date.UTC(2026, 3, 1)), income: 300 },
        { date: new Date(Date.UTC(2026, 4, 1)), income: 620 },
      ],
    });

    const { buildAutomatedEmailDigest } = await import("./digest");
    const result = await buildAutomatedEmailDigest({
      profile: {
        user_id: "user-1",
        display_currency: "USD",
        time_zone: "UTC",
      },
    });

    expect(fetchPositionsMock).toHaveBeenCalledWith(
      {
        positionType: "asset",
        includeArchived: false,
        asOfDateKey: "2026-04-17",
      },
      undefined,
    );
    expect(calculateNetWorthMock).toHaveBeenNthCalledWith(
      1,
      "USD",
      "2026-04-17",
      undefined,
    );
    expect(calculateNetWorthMock).toHaveBeenNthCalledWith(
      2,
      "USD",
      "2026-04-10",
      undefined,
    );
    expect(getTopMoversMock).toHaveBeenCalledWith({
      baseCurrency: "USD",
      startDate: "2026-04-10",
      endDate: "2026-04-17",
      limit: 3,
      todayDateKey: "2026-04-17",
      positionsQueryContext: undefined,
    });
    expect(calculateProjectedIncomeMock).toHaveBeenCalledWith(
      "USD",
      2,
      undefined,
      "2026-04-17",
    );

    expect(result).toMatchObject({
      eligible: true,
      digest: {
        userId: "user-1",
        currency: "USD",
        activePositionCount: 1,
        netWorth: {
          asOfDateKey: "2026-04-17",
          comparisonDateKey: "2026-04-10",
          currentValue: 1100,
          previousValue: 1000,
          absoluteChange: 100,
          percentageChange: 10,
        },
        topMovers: {
          analyzed: 2,
          gainers: [{ positionId: "position-1", changePct: 10 }],
          losers: [{ positionId: "position-2", changePct: -5 }],
        },
      },
    });

    if (!result.eligible || !result.digest.projectedIncome) {
      throw new Error("Expected projected income to be present in digest");
    }

    expect(result.digest.projectedIncome.nextThirtyDaysEstimate).toBeCloseTo(
      460,
      6,
    );
  });

  it("omits empty optional sections when analytics helpers return no content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    fetchPositionsMock.mockResolvedValue([{ id: "position-1" }]);
    calculateNetWorthMock.mockResolvedValueOnce(500).mockResolvedValueOnce(500);
    getTopMoversMock.mockResolvedValue({
      analyzed: 0,
      topByPct: {
        gainers: [],
        losers: [],
      },
    });
    calculateProjectedIncomeMock.mockResolvedValue({
      success: true,
      currency: "USD",
      data: [],
    });

    const { buildAutomatedEmailDigest } = await import("./digest");
    const result = await buildAutomatedEmailDigest({
      profile: {
        user_id: "user-1",
        display_currency: "USD",
        time_zone: "UTC",
      },
    });

    expect(result).toMatchObject({
      eligible: true,
      digest: {
        topMovers: null,
        projectedIncome: null,
      },
    });
  });
});
