import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatUTCDateKey } from "@/lib/date/date-utils";
import {
  getHistoricalQuotes,
  getHistoricalQuotesBatch,
} from "@/server/ai/tools/historical-quotes";

const { fetchQuotesMock, ensureSymbolMock } = vi.hoisted(() => ({
  fetchQuotesMock: vi.fn(),
  ensureSymbolMock: vi.fn(),
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchQuotes: fetchQuotesMock,
}));

vi.mock("@/server/symbols/ensure", () => ({
  ensureSymbol: ensureSymbolMock,
}));

describe("getHistoricalQuotes", () => {
  beforeEach(() => {
    fetchQuotesMock.mockReset();
    ensureSymbolMock.mockReset();

    ensureSymbolMock.mockResolvedValue({
      symbol: { id: "symbol-uuid", ticker: "VUSA.AS" },
      primaryAlias: { value: "VUSA.AS" },
    });
    fetchQuotesMock.mockResolvedValue(new Map());
  });

  it("clamps oversized date windows to the 365-day inclusive limit", async () => {
    const result = await getHistoricalQuotes({
      symbolLookup: "VUSA.AS",
      startDate: "2025-02-27",
      endDate: "2026-02-27",
    });

    expect(result.startDate).toBe("2025-02-28");
    expect(result.endDate).toBe("2026-02-27");
    expect(result.metadata.totalDays).toBe(365);
    expect(result.points).toHaveLength(365);

    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    const requests = fetchQuotesMock.mock.calls[0]?.[0] as Array<{
      symbolLookup: string;
      date: Date;
    }>;
    const firstRequest = requests[0];
    const lastRequest = requests.at(-1);

    expect(firstRequest).toBeDefined();
    expect(lastRequest).toBeDefined();
    expect(firstRequest?.symbolLookup).toBe("symbol-uuid");
    expect(formatUTCDateKey(firstRequest!.date)).toBe("2025-02-28");
    expect(formatUTCDateKey(lastRequest!.date)).toBe("2026-02-27");
  });

  it("batches multiple symbols into one quote fetch call and keeps unresolved lookups separate", async () => {
    ensureSymbolMock.mockImplementation(async (lookup: string) => {
      if (lookup === "INVALID") {
        return null;
      }

      return {
        symbol: { id: `${lookup}-id`, ticker: lookup },
        primaryAlias: { value: lookup },
      };
    });

    fetchQuotesMock.mockImplementation(
      async (
        requests: Array<{
          symbolLookup: string;
          date: Date;
        }>,
      ) => {
        return new Map(
          requests.map((request, index) => [
            `${request.symbolLookup}|${formatUTCDateKey(request.date)}`,
            index + 1,
          ]),
        );
      },
    );

    const result = await getHistoricalQuotesBatch({
      symbolLookups: ["AAPL", "MSFT", "INVALID", "AAPL"],
      startDate: "2026-01-01",
      endDate: "2026-01-03",
    });

    expect(result.symbols).toHaveLength(2);
    expect(result.unresolved).toEqual([
      {
        requestedLookup: "INVALID",
        error: 'Symbol "INVALID" not found.',
      },
    ]);
    expect(result.metadata.requestedSymbols).toBe(3);
    expect(result.metadata.resolvedSymbols).toBe(2);
    expect(result.metadata.unresolvedSymbols).toBe(1);
    expect(result.metadata.totalDays).toBe(3);

    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    const requests = fetchQuotesMock.mock.calls[0]?.[0] as Array<{
      symbolLookup: string;
      date: Date;
    }>;
    expect(requests).toHaveLength(6);

    const aaplResult = result.symbols.find(
      (item) => item.symbolTicker === "AAPL",
    );
    const msftResult = result.symbols.find(
      (item) => item.symbolTicker === "MSFT",
    );

    expect(aaplResult?.points).toHaveLength(3);
    expect(msftResult?.points).toHaveLength(3);
    expect(aaplResult?.points[0]?.status).toBe("ok");
    expect(msftResult?.points[2]?.status).toBe("ok");
  });
});
