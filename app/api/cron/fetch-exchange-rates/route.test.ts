import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const fetchCurrenciesMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();

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

vi.mock("@/server/currencies/fetch", () => ({
  fetchCurrencies: fetchCurrenciesMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

describe("GET /api/cron/fetch-exchange-rates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    process.env.CRON_SECRET = "test-cron-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    fetchCurrenciesMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    connectionMock.mockResolvedValue(undefined);

    fetchCurrenciesMock.mockResolvedValue([
      { alphabetic_code: "USD", name: "US Dollar" },
      { alphabetic_code: "EUR", name: "Euro" },
    ]);
    fetchExchangeRatesMock.mockResolvedValue(
      new Map([
        ["USD|2026-02-15", 1],
        ["EUR|2026-02-15", 0.92],
      ]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses today UTC by default and passes strict cron options", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-exchange-rates") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.windowDays).toBe(3);
    expect(body.stats.perDate).toHaveLength(3);
    expect(
      body.stats.perDate.map((entry: { date: string }) => entry.date),
    ).toEqual(["2026-02-15", "2026-02-14", "2026-02-13"]);
    expect(body.stats.successfulFetches).toBe(6);
    expect(body.stats.failedFetches).toBe(0);

    expect(fetchExchangeRatesMock).toHaveBeenCalledTimes(3);
    const expectedDates = [
      "2026-02-15T00:00:00.000Z",
      "2026-02-14T00:00:00.000Z",
      "2026-02-13T00:00:00.000Z",
    ];
    fetchExchangeRatesMock.mock.calls.forEach((call, index) => {
      const [requests, options] = call ?? [];
      expect(options).toEqual({
        upsert: true,
        staleGuardDays: 0,
        cronCutoffHourUtc: 0,
      });
      expect(requests).toEqual([
        { currency: "USD", date: new Date(expectedDates[index]) },
        { currency: "EUR", date: new Date(expectedDates[index]) },
      ]);
    });
  });

  it("accepts explicit ?date override and anchors rolling window", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const response = await GET(
      new Request(
        "http://localhost/api/cron/fetch-exchange-rates?date=2026-01-10",
      ) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.stats.perDate.map((entry: { date: string }) => entry.date),
    ).toEqual(["2026-01-10", "2026-01-09", "2026-01-08"]);

    expect(fetchExchangeRatesMock).toHaveBeenCalledTimes(3);
    expect(fetchExchangeRatesMock.mock.calls[0]?.[0]?.[0]?.date).toEqual(
      new Date("2026-01-10T00:00:00.000Z"),
    );
    expect(fetchExchangeRatesMock.mock.calls[1]?.[0]?.[0]?.date).toEqual(
      new Date("2026-01-09T00:00:00.000Z"),
    );
    expect(fetchExchangeRatesMock.mock.calls[2]?.[0]?.[0]?.date).toEqual(
      new Date("2026-01-08T00:00:00.000Z"),
    );
  });

  it("retries transient date-level failures and succeeds", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    let callCount = 0;
    fetchExchangeRatesMock.mockImplementation(
      (requests: Array<{ currency: string; date: Date }>) => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("503 Service Unavailable"));
        }

        return Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.currency}|${request.date.toISOString().slice(0, 10)}`,
              request.currency === "USD" ? 1 : 0.92,
            ]),
          ),
        );
      },
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const responsePromise = GET(
      new Request("http://localhost/api/cron/fetch-exchange-rates") as never,
    );

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.retryCount).toBe(1);
    expect(body.stats.perDate[0]?.retryCount).toBe(1);
    expect(fetchExchangeRatesMock).toHaveBeenCalledTimes(4);
  });

  it("returns 200 with partial-failure stats when one date fails", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    let callCount = 0;
    fetchExchangeRatesMock.mockImplementation(
      (requests: Array<{ currency: string; date: Date }>) => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error("Permanent parser error"));
        }

        return Promise.resolve(
          new Map(
            requests.map((request) => [
              `${request.currency}|${request.date.toISOString().slice(0, 10)}`,
              request.currency === "USD" ? 1 : 0.92,
            ]),
          ),
        );
      },
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-exchange-rates") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("partial failures");
    expect(body.stats.failedFetches).toBe(2);
    expect(body.stats.failedBatchCount).toBe(1);
    expect(body.stats.retryCount).toBe(0);
  });

  it("returns 400 for invalid date", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const response = await GET(
      new Request(
        "http://localhost/api/cron/fetch-exchange-rates?date=2026-02-31",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(fetchExchangeRatesMock).not.toHaveBeenCalled();
  });

  it("returns 401 when auth header is invalid", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer wrong-secret" }),
    );

    const { GET } = await import("@/app/api/cron/fetch-exchange-rates/route");
    const response = await GET(
      new Request("http://localhost/api/cron/fetch-exchange-rates") as never,
    );

    expect(response.status).toBe(401);
    expect(fetchExchangeRatesMock).not.toHaveBeenCalled();
  });
});
