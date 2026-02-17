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

    expect(fetchExchangeRatesMock).toHaveBeenCalledTimes(1);
    const [requests, options] = fetchExchangeRatesMock.mock.calls[0] ?? [];
    expect(options).toEqual({ upsert: true, staleGuardDays: 0 });
    expect(requests).toEqual([
      { currency: "USD", date: new Date("2026-02-15T00:00:00.000Z") },
      { currency: "EUR", date: new Date("2026-02-15T00:00:00.000Z") },
    ]);
  });

  it("accepts explicit ?date override", async () => {
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

    const [requests] = fetchExchangeRatesMock.mock.calls[0] ?? [];
    expect(requests[0]?.date).toEqual(new Date("2026-01-10T00:00:00.000Z"));
    expect(requests[1]?.date).toEqual(new Date("2026-01-10T00:00:00.000Z"));
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
