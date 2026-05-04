import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTopMovers } from "@/server/ai/tools/top-movers";

const { getAssetsPerformanceMock } = vi.hoisted(() => ({
  getAssetsPerformanceMock: vi.fn(),
}));

vi.mock("@/server/ai/tools/assets-performance", () => ({
  getAssetsPerformance: getAssetsPerformanceMock,
}));

interface FakeAssetInput {
  id: string;
  symbol: string;
  priceReturnPct: number;
  valueChangeAbs: number;
}

function createFakeAsset({
  id,
  symbol,
  priceReturnPct,
  valueChangeAbs,
}: FakeAssetInput) {
  return {
    asset: {
      id,
      name: `${symbol} Inc.`,
      symbol,
      category: "stock",
      currency: "USD",
      isArchived: false,
    },
    period: {
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      baseCurrency: "USD",
      partialPeriod: false,
    },
    price: { start: 100, end: 100, startBase: 100, endBase: 100 },
    quantity: { start: 1, end: 1 },
    value: { startBase: 100, endBase: 100 },
    performance: {
      priceReturnPct,
      valueChangeAbs,
      valueChangePct: priceReturnPct,
    },
    unrealized: { totalCostBasis: 100, profitLoss: 0, profitLossPct: 0 },
  };
}

function mockPerfWithAssets(assets: FakeAssetInput[]) {
  getAssetsPerformanceMock.mockResolvedValue({
    period: {
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      daysCount: 7,
      baseCurrency: "USD",
    },
    assets: assets.map(createFakeAsset),
  });
}

describe("getTopMovers", () => {
  beforeEach(() => {
    getAssetsPerformanceMock.mockReset();
  });

  it("never lists the same asset as both a gainer and a loser when assets <= limit", async () => {
    mockPerfWithAssets([
      { id: "p-1", symbol: "BITF", priceReturnPct: -1.6, valueChangeAbs: -25 },
      {
        id: "p-2",
        symbol: "MSFT",
        priceReturnPct: -2.4,
        valueChangeAbs: -41.52,
      },
      {
        id: "p-3",
        symbol: "SOFI",
        priceReturnPct: -12.4,
        valueChangeAbs: -233,
      },
    ]);

    const result = await getTopMovers({
      baseCurrency: "USD",
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      limit: 3,
    });

    expect(result.topByPct.gainers).toEqual([]);
    expect(result.topByPct.losers.map((l) => l.asset.id)).toEqual([
      "p-3",
      "p-2",
      "p-1",
    ]);
    expect(result.topByAbs.gainers).toEqual([]);
    expect(result.topByAbs.losers.map((l) => l.asset.id)).toEqual([
      "p-3",
      "p-2",
      "p-1",
    ]);
  });

  it("returns a single gainer with no losers when the portfolio has one positive asset", async () => {
    mockPerfWithAssets([
      {
        id: "p-1",
        symbol: "XDWS.SW",
        priceReturnPct: 0.4,
        valueChangeAbs: 23.13,
      },
    ]);

    const result = await getTopMovers({
      baseCurrency: "USD",
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      limit: 3,
    });

    expect(result.topByPct.gainers.map((g) => g.asset.id)).toEqual(["p-1"]);
    expect(result.topByPct.losers).toEqual([]);
    expect(result.topByAbs.gainers.map((g) => g.asset.id)).toEqual(["p-1"]);
    expect(result.topByAbs.losers).toEqual([]);
  });

  it("excludes flat assets from both gainer and loser lists", async () => {
    mockPerfWithAssets([
      { id: "p-up", symbol: "AAA", priceReturnPct: 5, valueChangeAbs: 50 },
      { id: "p-flat", symbol: "BBB", priceReturnPct: 0, valueChangeAbs: 0 },
      { id: "p-down", symbol: "CCC", priceReturnPct: -3, valueChangeAbs: -30 },
    ]);

    const result = await getTopMovers({
      baseCurrency: "USD",
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      limit: 5,
    });

    expect(result.topByPct.gainers.map((g) => g.asset.id)).toEqual(["p-up"]);
    expect(result.topByPct.losers.map((l) => l.asset.id)).toEqual(["p-down"]);
    expect(result.topByAbs.gainers.map((g) => g.asset.id)).toEqual(["p-up"]);
    expect(result.topByAbs.losers.map((l) => l.asset.id)).toEqual(["p-down"]);
  });

  it("orders gainers descending and losers most-negative first, capping at limit", async () => {
    mockPerfWithAssets([
      { id: "g-1", symbol: "GA", priceReturnPct: 12, valueChangeAbs: 120 },
      { id: "g-2", symbol: "GB", priceReturnPct: 8, valueChangeAbs: 80 },
      { id: "g-3", symbol: "GC", priceReturnPct: 4, valueChangeAbs: 40 },
      { id: "g-4", symbol: "GD", priceReturnPct: 1, valueChangeAbs: 10 },
      { id: "l-1", symbol: "LA", priceReturnPct: -3, valueChangeAbs: -30 },
      { id: "l-2", symbol: "LB", priceReturnPct: -7, valueChangeAbs: -70 },
      { id: "l-3", symbol: "LC", priceReturnPct: -11, valueChangeAbs: -110 },
      { id: "l-4", symbol: "LD", priceReturnPct: -15, valueChangeAbs: -150 },
    ]);

    const result = await getTopMovers({
      baseCurrency: "USD",
      startDate: "2026-04-27",
      endDate: "2026-05-04",
      limit: 3,
    });

    expect(result.topByPct.gainers.map((g) => g.asset.id)).toEqual([
      "g-1",
      "g-2",
      "g-3",
    ]);
    expect(result.topByPct.losers.map((l) => l.asset.id)).toEqual([
      "l-4",
      "l-3",
      "l-2",
    ]);
    expect(result.topByAbs.gainers.map((g) => g.asset.id)).toEqual([
      "g-1",
      "g-2",
      "g-3",
    ]);
    expect(result.topByAbs.losers.map((l) => l.asset.id)).toEqual([
      "l-4",
      "l-3",
      "l-2",
    ]);
  });
});
