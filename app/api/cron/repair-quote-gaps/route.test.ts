import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const runQuoteRepairQueueMock = vi.fn();

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

vi.mock("@/server/quotes/repair-worker", () => ({
  runQuoteRepairQueue: runQuoteRepairQueueMock,
}));

describe("GET /api/cron/repair-quote-gaps", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    runQuoteRepairQueueMock.mockReset();

    connectionMock.mockResolvedValue(undefined);
  });

  it("rejects unauthorized requests", async () => {
    headersMock.mockResolvedValue(new Headers());

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(runQuoteRepairQueueMock).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer undefined" }),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(runQuoteRepairQueueMock).not.toHaveBeenCalled();
  });

  it("returns the structured worker result", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runQuoteRepairQueueMock.mockResolvedValue({
      success: true,
      message: "No quote repair jobs were due",
      stats: {
        claimedJobs: 0,
        resolvedExact: 0,
        nonTradingOrNoExact: 0,
        retriesScheduled: 0,
        terminalFailures: 0,
        skippedMissingSymbol: 0,
        quoteRowsUpserted: 0,
        symbolHealthUpdates: 0,
      },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "No quote repair jobs were due",
      stats: {
        claimedJobs: 0,
        resolvedExact: 0,
        nonTradingOrNoExact: 0,
        retriesScheduled: 0,
        terminalFailures: 0,
        skippedMissingSymbol: 0,
        quoteRowsUpserted: 0,
        symbolHealthUpdates: 0,
      },
    });
    expect(runQuoteRepairQueueMock).toHaveBeenCalledTimes(1);
  });

  it("returns a 500 response when the worker throws", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runQuoteRepairQueueMock.mockRejectedValue(new Error("boom"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "boom",
    });
  });
});
