import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const fetchQuotesMock = vi.fn();
const fetchActivePositionSymbolsMock = vi.fn();
const purgeUnlinkedSymbolsMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/server", () => ({
  connection: connectionMock,
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchQuotes: fetchQuotesMock,
}));

vi.mock("@/server/symbols/fetch", () => ({
  fetchActivePositionSymbols: fetchActivePositionSymbolsMock,
  purgeUnlinkedSymbols: purgeUnlinkedSymbolsMock,
}));

describe("GET /api/admin/prewarm-quotes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"));

    process.env.CRON_SECRET = "cron-secret";
    process.env.PREWARM_SECRET = "prewarm-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    fetchQuotesMock.mockReset();
    fetchActivePositionSymbolsMock.mockReset();
    purgeUnlinkedSymbolsMock.mockReset();

    connectionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when authorization is invalid", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer wrong-secret" }),
    );

    const { GET } = await import("@/app/api/admin/prewarm-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/admin/prewarm-quotes") as never,
    );

    expect(response.status).toBe(401);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });

  it("runs purge on first batch when requested and prewarms selected symbols", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer prewarm-secret" }),
    );
    purgeUnlinkedSymbolsMock.mockResolvedValue(4);
    fetchActivePositionSymbolsMock.mockResolvedValue([
      "sym-1",
      "sym-2",
      "sym-3",
    ]);
    fetchQuotesMock.mockResolvedValue(
      new Map([
        ["sym-1|2026-02-14", 100],
        ["sym-1|2026-02-15", 101],
        ["sym-1|2026-02-16", 102],
        ["sym-2|2026-02-14", 200],
        ["sym-2|2026-02-15", 201],
        ["sym-2|2026-02-16", 202],
      ]),
    );

    const { GET } = await import("@/app/api/admin/prewarm-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/prewarm-quotes?cursor=0&batchSize=2&daysBack=3&date=2026-02-16&purgeOrphans=true",
      ) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.totalSymbols).toBe(3);
    expect(body.stats.processedSymbols).toBe(2);
    expect(body.stats.expectedRequests).toBe(6);
    expect(body.stats.resolvedRequests).toBe(6);
    expect(body.stats.nextCursor).toBe(2);
    expect(body.stats.purgedOrphanSymbols).toBe(4);

    expect(purgeUnlinkedSymbolsMock).toHaveBeenCalledTimes(1);
    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    const [requests, options] = fetchQuotesMock.mock.calls[0] ?? [];
    expect(options).toEqual({ upsert: true, staleGuardDays: 0 });
    expect(requests).toHaveLength(6);
    expect(requests[0]).toEqual({
      symbolLookup: "sym-1",
      date: new Date("2026-02-14T00:00:00.000Z"),
    });
    expect(requests[5]).toEqual({
      symbolLookup: "sym-2",
      date: new Date("2026-02-16T00:00:00.000Z"),
    });
  });

  it("returns complete when cursor is beyond available symbols", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer prewarm-secret" }),
    );
    fetchActivePositionSymbolsMock.mockResolvedValue(["sym-1"]);
    fetchQuotesMock.mockResolvedValue(new Map());

    const { GET } = await import("@/app/api/admin/prewarm-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/prewarm-quotes?cursor=5&batchSize=10&daysBack=7",
      ) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.processedSymbols).toBe(0);
    expect(body.stats.nextCursor).toBe(null);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid date override", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer prewarm-secret" }),
    );

    const { GET } = await import("@/app/api/admin/prewarm-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/prewarm-quotes?date=2026-02-31",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });
});
