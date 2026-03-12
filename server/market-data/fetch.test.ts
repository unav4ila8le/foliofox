import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatUTCDateKey } from "@/lib/date/date-utils";

const fetchForPositionsMock = vi.fn();
const fetchForPositionsRangeMock = vi.fn();

vi.mock("./sources/registry", () => ({
  MARKET_DATA_HANDLERS: [
    {
      source: "symbol",
      fetchForPositions: fetchForPositionsMock,
      fetchForPositionsRange: fetchForPositionsRangeMock,
      getKey(position: { symbol_id?: string | null }, date: Date) {
        if (!position.symbol_id) return null;
        return `${position.symbol_id}|${formatUTCDateKey(date)}`;
      },
    },
  ],
}));

describe("fetchMarketDataRange", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchForPositionsMock.mockReset();
    fetchForPositionsRangeMock.mockReset();
  });

  it("forwards liveFetchOnMiss to range handlers", async () => {
    fetchForPositionsRangeMock.mockResolvedValue(
      new Map([["sym-1|2026-02-25", 123]]),
    );

    const { fetchMarketDataRange } = await import("./fetch");
    const result = await fetchMarketDataRange(
      [
        {
          id: "pos-1",
          currency: "USD",
          symbol_id: "sym-1",
          domain_id: null,
        },
      ],
      [new Date("2026-02-25T00:00:00.000Z")],
      {
        upsert: true,
        liveFetchOnMiss: true,
      },
    );

    expect(fetchForPositionsRangeMock).toHaveBeenCalledTimes(1);
    expect(fetchForPositionsRangeMock).toHaveBeenCalledWith(
      [
        {
          id: "pos-1",
          currency: "USD",
          symbol_id: "sym-1",
          domain_id: null,
        },
      ],
      [new Date("2026-02-25T00:00:00.000Z")],
      expect.objectContaining({
        upsert: true,
        liveFetchOnMiss: true,
      }),
    );
    expect(result).toEqual(new Map([["pos-1|2026-02-25", 123]]));
  });
});
