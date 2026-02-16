import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const fetchSymbolsMock = vi.fn();
const fetchQuotesMock = vi.fn();

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

vi.mock("@/server/symbols/fetch", () => ({
  fetchSymbols: fetchSymbolsMock,
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchQuotes: fetchQuotesMock,
}));

describe("GET /api/cron/fetch-quotes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    process.env.CRON_SECRET = "test-cron-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    fetchSymbolsMock.mockReset();
    fetchQuotesMock.mockReset();

    connectionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses today UTC by default and passes cron options to fetchQuotes", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(["sym-1", "sym-2"]);
    fetchQuotesMock.mockResolvedValue(new Map([["sym-1|2026-02-15", 123]]));

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.date).toBe("2026-02-15");

    expect(fetchQuotesMock).toHaveBeenCalledTimes(1);
    const [requests, options] = fetchQuotesMock.mock.calls[0] ?? [];

    expect(options).toEqual({ upsert: true, staleGuardDays: 0 });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.symbolLookup).toBe("sym-1");
    expect(requests[1]?.symbolLookup).toBe("sym-2");
    expect(requests[0]?.date?.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("accepts explicit ?date override", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(["sym-1"]);
    fetchQuotesMock.mockResolvedValue(new Map([["sym-1|2026-01-10", 123]]));

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/cron/fetch-quotes?date=2026-01-10",
      ) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.date).toBe("2026-01-10");

    const [requests] = fetchQuotesMock.mock.calls[0] ?? [];
    expect(requests[0]?.date?.toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });

  it("returns 400 for invalid date format", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/cron/fetch-quotes?date=2026-02-31",
      ) as never,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is invalid", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer invalid-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(401);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });
});
