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

function createCronSymbols(...ids: string[]) {
  return ids.map((id) => ({ id, ticker: id.toUpperCase() }));
}

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
    fetchSymbolsMock.mockResolvedValue(createCronSymbols("sym-1", "sym-2"));
    fetchQuotesMock.mockImplementation(
      (
        requests: Array<{ symbolLookup: string; date: Date }>,
        options?: {
          resolutionStats?: {
            exactDateMatches: number;
            fallbackResolutions: number;
          };
        },
      ) => {
        if (options?.resolutionStats) {
          options.resolutionStats.exactDateMatches = requests.length;
          options.resolutionStats.fallbackResolutions = 0;
        }

        return Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.symbolLookup}|${request.date.toISOString().slice(0, 10)}`,
              123,
            ]),
          ),
        );
      },
    );

    const { GET, maxDuration } =
      await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.date).toBe("2026-02-15");
    expect(body.stats.windowDays).toBe(3);
    expect(body.stats.resolvedRequests).toBe(6);
    expect(body.stats.successfulFetches).toBe(6);
    expect(body.stats.exactDateMatches).toBe(6);
    expect(body.stats.fallbackResolutions).toBe(0);
    expect(body.stats.failedFetches).toBe(0);
    expect(body.stats.retryCount).toBe(0);
    expect(body.stats.failedBatchCount).toBe(0);
    expect(maxDuration).toBe(800);
    expect(body.stats.perDate).toHaveLength(3);
    expect(
      body.stats.perDate.map((entry: { date: string }) => entry.date),
    ).toEqual(["2026-02-15", "2026-02-14", "2026-02-13"]);

    expect(fetchQuotesMock).toHaveBeenCalledTimes(3);
    const expectedDates = [
      "2026-02-15T00:00:00.000Z",
      "2026-02-14T00:00:00.000Z",
      "2026-02-13T00:00:00.000Z",
    ];
    fetchQuotesMock.mock.calls.forEach((call, index) => {
      const [requests, options] = call;
      expect(options).toMatchObject({
        upsert: true,
        staleGuardDays: 0,
        cronCutoffHourUtc: 0,
        liveMissCooldownMinutes: 0,
      });
      expect(options?.resolutionStats).toBeDefined();
      expect(requests).toHaveLength(2);
      expect(requests[0]?.symbolLookup).toBe("sym-1");
      expect(requests[1]?.symbolLookup).toBe("sym-2");
      expect(requests[0]?.date?.toISOString()).toBe(expectedDates[index]);
      expect(requests[1]?.date?.toISOString()).toBe(expectedDates[index]);
    });
  });

  it("returns consistent stats shape when no symbols exist", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue([]);

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("No symbols to fetch");
    expect(body.stats.totalSymbols).toBe(0);
    expect(body.stats.resolvedRequests).toBe(0);
    expect(body.stats.exactDateMatches).toBe(0);
    expect(body.stats.fallbackResolutions).toBe(0);
    expect(body.stats.windowDays).toBe(3);
    expect(body.stats.perDate).toHaveLength(3);
    expect(
      body.stats.perDate.map((entry: { date: string }) => entry.date),
    ).toEqual(["2026-02-15", "2026-02-14", "2026-02-13"]);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });

  it("accepts explicit ?date override and anchors rolling window", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(createCronSymbols("sym-1"));
    fetchQuotesMock.mockImplementation(
      (requests: Array<{ symbolLookup: string; date: Date }>) =>
        Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.symbolLookup}|${request.date.toISOString().slice(0, 10)}`,
              123,
            ]),
          ),
        ),
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request(
        "http://localhost/api/cron/fetch-quotes?date=2026-01-10",
      ) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.date).toBe("2026-01-10");
    expect(
      body.stats.perDate.map((entry: { date: string }) => entry.date),
    ).toEqual(["2026-01-10", "2026-01-09", "2026-01-08"]);

    expect(fetchQuotesMock).toHaveBeenCalledTimes(3);
    expect(fetchQuotesMock.mock.calls[0]?.[0]?.[0]?.date?.toISOString()).toBe(
      "2026-01-10T00:00:00.000Z",
    );
    expect(fetchQuotesMock.mock.calls[1]?.[0]?.[0]?.date?.toISOString()).toBe(
      "2026-01-09T00:00:00.000Z",
    );
    expect(fetchQuotesMock.mock.calls[2]?.[0]?.[0]?.date?.toISOString()).toBe(
      "2026-01-08T00:00:00.000Z",
    );
  });

  it("retries transient batch failures and succeeds", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(createCronSymbols("sym-1", "sym-2"));

    let callCount = 0;
    fetchQuotesMock.mockImplementation(
      (requests: Array<{ symbolLookup: string; date: Date }>) => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("502 Bad Gateway"));
        }

        return Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.symbolLookup}|${request.date.toISOString().slice(0, 10)}`,
              123,
            ]),
          ),
        );
      },
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const responsePromise = GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.retryCount).toBe(1);
    expect(body.stats.perDate[0]?.retryCount).toBe(1);
    expect(fetchQuotesMock).toHaveBeenCalledTimes(4);
  });

  it("returns 200 with partial-failure stats when a date batch fails", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(createCronSymbols("sym-1", "sym-2"));
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    let callCount = 0;
    fetchQuotesMock.mockImplementation(
      (requests: Array<{ symbolLookup: string; date: Date }>) => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("Permanent parse error"));
        }

        return Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.symbolLookup}|${request.date.toISOString().slice(0, 10)}`,
              123,
            ]),
          ),
        );
      },
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("partial failures");
    expect(body.stats.failedFetches).toBe(2);
    expect(body.stats.failedBatchCount).toBe(1);
    expect(body.stats.retryCount).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[quote-cron] unresolved date=2026-02-15 batch=1/1 count=2 symbols=SYM-1,SYM-2 error=Permanent parse error",
    );
    consoleWarnSpy.mockRestore();
  });

  it("logs unresolved tickers from successful partial batches", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(createCronSymbols("sym-1", "sym-2"));
    fetchQuotesMock.mockImplementation(
      (requests: Array<{ symbolLookup: string; date: Date }>) => {
        const firstRequest = requests[0];
        return Promise.resolve(
          new Map([
            [
              `${firstRequest.symbolLookup}|${firstRequest.date.toISOString().slice(0, 10)}`,
              123,
            ],
          ]),
        );
      },
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    const body = await response.json();
    expect(body.stats.failedFetches).toBe(3);
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      1,
      "[quote-cron] unresolved date=2026-02-15 batch=1/1 count=1 symbols=SYM-2",
    );
    consoleWarnSpy.mockRestore();
  });

  it("keeps four batches in flight and reuses a freed worker slot", async () => {
    vi.useRealTimers();
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    fetchSymbolsMock.mockResolvedValue(
      Array.from({ length: 751 }, (_, index) => ({
        id: `sym-${index}`,
        ticker: `T${index}`,
      })),
    );

    const gates = Array.from({ length: 4 }, () => {
      let resolve = () => {};
      const promise = new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
      });
      return { promise, resolve };
    });
    let callIndex = 0;
    let activeCalls = 0;
    let maxActiveCalls = 0;

    fetchQuotesMock.mockImplementation(
      async (requests: Array<{ symbolLookup: string; date: Date }>) => {
        const currentCallIndex = callIndex;
        callIndex += 1;
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);

        await (gates[currentCallIndex]?.promise ?? Promise.resolve());
        activeCalls -= 1;

        return new Map(
          requests.map((request) => [
            `${request.symbolLookup}|${request.date.toISOString().slice(0, 10)}`,
            123,
          ]),
        );
      },
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const responsePromise = GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    await vi.waitFor(() => expect(fetchQuotesMock).toHaveBeenCalledTimes(4));
    expect(maxActiveCalls).toBe(4);

    gates[1].resolve();
    await vi.waitFor(() =>
      expect(fetchQuotesMock.mock.calls.length).toBeGreaterThanOrEqual(5),
    );
    expect(maxActiveCalls).toBe(4);

    gates[0].resolve();
    gates[2].resolve();
    gates[3].resolve();

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(maxActiveCalls).toBe(4);
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

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer undefined" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-quotes/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-quotes") as never,
    );

    expect(response.status).toBe(500);
    expect(fetchQuotesMock).not.toHaveBeenCalled();
  });
});
