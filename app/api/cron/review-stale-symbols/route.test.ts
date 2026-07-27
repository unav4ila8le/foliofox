import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const runSymbolReviewMock = vi.fn();

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

vi.mock("@/server/symbol-review/worker", () => ({
  runSymbolReview: runSymbolReviewMock,
}));

describe("GET /api/cron/review-stale-symbols", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    runSymbolReviewMock.mockReset();

    connectionMock.mockResolvedValue(undefined);
  });

  it("runs the review and returns its stats", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runSymbolReviewMock.mockResolvedValue({
      success: true,
      message: "Symbol review processed",
      stats: { candidates: 2, reviewed: 2, failed: 0, digestsSent: 1 },
    });

    const { GET, maxDuration } =
      await import("@/app/api/cron/review-stale-symbols/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.stats.reviewed).toBe(2);
    expect(maxDuration).toBe(800);
    expect(runSymbolReviewMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when authorization header is invalid", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer invalid-secret" }),
    );

    const { GET } = await import("@/app/api/cron/review-stale-symbols/route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(runSymbolReviewMock).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer undefined" }),
    );

    const { GET } = await import("@/app/api/cron/review-stale-symbols/route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(runSymbolReviewMock).not.toHaveBeenCalled();
  });

  it("surfaces a worker failure as a 500 instead of throwing", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runSymbolReviewMock.mockRejectedValue(new Error("candidate query failed"));

    const { GET } = await import("@/app/api/cron/review-stale-symbols/route");
    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("candidate query failed");
  });
});
