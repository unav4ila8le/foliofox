import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

function createPositionsClient(data: unknown[] | null, errorAtCall?: number) {
  let queryCount = 0;

  return {
    queryCount: () => queryCount,
    client: {
      from: () => {
        let cursor: string | null = null;
        let limit = 1_000;

        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          not() {
            return this;
          },
          order() {
            return this;
          },
          limit(value: number) {
            limit = value;
            return this;
          },
          gt(_column: string, value: string) {
            cursor = value;
            return this;
          },
          then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?:
              | ((value: {
                  data: unknown[] | null;
                  error: { message: string } | null;
                }) => TResult1)
              | null,
            onrejected?:
              ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) {
            queryCount += 1;

            if (queryCount === errorAtCall) {
              return Promise.resolve({
                data: null,
                error: { message: "query failed" },
              }).then(onfulfilled ?? undefined, onrejected);
            }

            const page = (data ?? [])
              .filter((row) => {
                if (cursor === null) return true;
                return (row as { id: string }).id > cursor;
              })
              .slice(0, limit);

            return Promise.resolve({ data: page, error: null }).then(
              onfulfilled ?? undefined,
              onrejected,
            );
          },
        };
      },
    },
  };
}

describe("fetchMarketDataStatuses", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
    getCurrentUserMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("distinguishes stale, unavailable, and healthy market data", async () => {
    const activeAlias = {
      source: "yahoo",
      type: "ticker",
      effective_to: null,
    };
    const retiredAlias = {
      source: "yahoo",
      type: "ticker",
      effective_to: "2026-06-01T00:00:00.000Z",
    };
    const positions = [
      {
        id: "healthy",
        name: "Healthy",
        symbols: {
          ticker: "GOOD",
          last_quote_at: "2026-07-21T00:00:00.000Z",
          symbol_aliases: [activeAlias],
        },
      },
      {
        id: "stale",
        name: "Stale Asset",
        symbols: {
          ticker: "OLD",
          last_quote_at: "2026-07-01T00:00:00.000Z",
          symbol_aliases: [activeAlias],
        },
      },
      {
        id: "unavailable",
        name: "Unavailable Asset",
        symbols: {
          ticker: "GONE",
          last_quote_at: "2026-07-21T00:00:00.000Z",
          symbol_aliases: [retiredAlias],
        },
      },
      {
        id: "missing-alias",
        name: "Missing Alias",
        symbols: {
          ticker: "LEGACY",
          last_quote_at: null,
          symbol_aliases: [],
        },
      },
      {
        id: "renamed-but-stale",
        name: "Renamed Asset",
        symbols: {
          ticker: "NEW",
          last_quote_at: "2026-07-01T00:00:00.000Z",
          symbol_aliases: [retiredAlias, activeAlias],
        },
      },
    ];

    const { client } = createPositionsClient(positions);
    getCurrentUserMock.mockResolvedValue({
      supabase: client,
      user: { id: "user-1" },
    });

    const { fetchMarketDataStatuses } = await import("./stale");

    await expect(fetchMarketDataStatuses()).resolves.toEqual([
      {
        positionId: "stale",
        positionName: "Stale Asset",
        ticker: "OLD",
        status: "stale",
      },
      {
        positionId: "unavailable",
        positionName: "Unavailable Asset",
        ticker: "GONE",
        status: "unavailable",
      },
      {
        positionId: "missing-alias",
        positionName: "Missing Alias",
        ticker: "LEGACY",
        status: "stale",
      },
      {
        positionId: "renamed-but-stale",
        positionName: "Renamed Asset",
        ticker: "NEW",
        status: "stale",
      },
    ]);
  });

  it("paginates positions and handles array-shaped symbol joins", async () => {
    const activeAlias = {
      source: "yahoo",
      type: "ticker",
      effective_to: null,
    };
    const positions = Array.from({ length: 1_001 }, (_, index) => ({
      id: `position-${String(index).padStart(4, "0")}`,
      name: `Position ${index}`,
      symbols:
        index === 1_000
          ? [
              {
                ticker: "LAST",
                last_quote_at: null,
                symbol_aliases: [activeAlias],
              },
            ]
          : {
              ticker: `T${index}`,
              last_quote_at: "2026-07-21T00:00:00.000Z",
              symbol_aliases: [activeAlias],
            },
    }));

    const { client, queryCount } = createPositionsClient(positions);
    getCurrentUserMock.mockResolvedValue({
      supabase: client,
      user: { id: "user-1" },
    });

    const { fetchMarketDataStatuses } = await import("./stale");

    await expect(fetchMarketDataStatuses()).resolves.toEqual([
      {
        positionId: "position-1000",
        positionName: "Position 1000",
        ticker: "LAST",
        status: "stale",
      },
    ]);
    expect(queryCount()).toBe(2);
  });

  it("fails quietly when the status query fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { client } = createPositionsClient(null, 1);
    getCurrentUserMock.mockResolvedValue({
      supabase: client,
      user: { id: "user-1" },
    });

    const { fetchMarketDataStatuses } = await import("./stale");

    await expect(fetchMarketDataStatuses()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
