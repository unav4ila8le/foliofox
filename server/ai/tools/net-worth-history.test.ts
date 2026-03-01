import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNetWorthHistory } from "@/server/ai/tools/net-worth-history";

const { fetchNetWorthHistoryMock } = vi.hoisted(() => ({
  fetchNetWorthHistoryMock: vi.fn(),
}));

vi.mock("@/server/analysis/net-worth/net-worth-history", () => ({
  fetchNetWorthHistory: fetchNetWorthHistoryMock,
}));

function utcDate(dayOffset: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + dayOffset));
}

describe("getNetWorthHistory", () => {
  beforeEach(() => {
    fetchNetWorthHistoryMock.mockReset();
  });

  it("trims leading zero-only history and marks short history as unsuitable for return drift", async () => {
    fetchNetWorthHistoryMock.mockResolvedValue([
      { date: utcDate(0), value: 0 },
      { date: utcDate(1), value: 0 },
      { date: utcDate(2), value: 100 },
      { date: utcDate(3), value: 105 },
      { date: utcDate(4), value: 110 },
    ]);

    const result = await getNetWorthHistory({
      baseCurrency: null,
      daysBack: 30,
      mode: null,
    });

    expect(result.total).toBe(5);
    expect(result.returned).toBe(3);
    expect(result.period).toEqual({
      start: "2026-01-03",
      end: "2026-01-05",
    });
    expect(result.items).toEqual([
      { date: "2026-01-03", value: 100 },
      { date: "2026-01-04", value: 105 },
      { date: "2026-01-05", value: 110 },
    ]);
    expect(result.historyQuality).toMatchObject({
      firstNonZeroDate: "2026-01-03",
      lastNonZeroDate: "2026-01-05",
      nonZeroCount: 3,
      nonZeroSpanDays: 3,
      zeroRatio: 0,
      isSuitableForReturnDrift: false,
      driftSuitability: "insufficient_history",
      guidance:
        "Use traditional long-run market assumptions as base case; use this history as sensitivity only.",
    });
  });

  it("marks representative history as suitable when coverage is long enough", async () => {
    const longHistory = Array.from({ length: 370 }, (_, index) => ({
      date: utcDate(index),
      value: index < 5 ? 0 : 100 + index,
    }));
    fetchNetWorthHistoryMock.mockResolvedValue(longHistory);

    const result = await getNetWorthHistory({
      baseCurrency: null,
      daysBack: 370,
      mode: "gross",
    });

    expect(result.returned).toBe(365);
    expect(result.historyQuality).toMatchObject({
      firstNonZeroDate: "2026-01-06",
      lastNonZeroDate: "2027-01-05",
      nonZeroCount: 365,
      nonZeroSpanDays: 365,
      zeroRatio: 0,
      isSuitableForReturnDrift: true,
      driftSuitability: "suitable",
      guidance: "History is suitable as a return-drift input.",
    });
  });

  it("marks long history with frequent zero values as sparse_history", async () => {
    const sparseHistory = [
      ...Array.from({ length: 5 }, (_, index) => ({
        date: utcDate(index),
        value: 0,
      })),
      ...Array.from({ length: 500 }, (_, index) => ({
        date: utcDate(index + 5),
        value: index % 5 === 0 ? 0 : 1_000 + index,
      })),
    ];
    fetchNetWorthHistoryMock.mockResolvedValue(sparseHistory);

    const result = await getNetWorthHistory({
      baseCurrency: null,
      daysBack: 505,
      mode: "gross",
    });

    expect(result.historyQuality).toMatchObject({
      nonZeroCount: 400,
      nonZeroSpanDays: 499,
      zeroRatio: 0.1984,
      isSuitableForReturnDrift: false,
      driftSuitability: "sparse_history",
      guidance:
        "Use traditional long-run market assumptions as base case; use this history as sensitivity only.",
    });
  });

  it("marks all-zero history as insufficient with explicit no-data guidance", async () => {
    fetchNetWorthHistoryMock.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        date: utcDate(index),
        value: 0,
      })),
    );

    const result = await getNetWorthHistory({
      baseCurrency: null,
      daysBack: 10,
      mode: "gross",
    });

    expect(result.returned).toBe(10);
    expect(result.historyQuality).toMatchObject({
      firstNonZeroDate: null,
      lastNonZeroDate: null,
      nonZeroCount: 0,
      nonZeroSpanDays: 0,
      zeroRatio: 1,
      isSuitableForReturnDrift: false,
      driftSuitability: "insufficient_history",
      guidance:
        "No non-zero history found. Use traditional long-run market assumptions as base case.",
    });
  });
});
