import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const connectionMock = vi.fn();
const runAutomatedEmailCronMock = vi.fn();

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

vi.mock("@/server/automated-emails/run", () => ({
  runAutomatedEmailCron: runAutomatedEmailCronMock,
}));

describe("GET /api/cron/send-automated-emails", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";

    headersMock.mockReset();
    connectionMock.mockReset();
    runAutomatedEmailCronMock.mockReset();

    connectionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthorized requests", async () => {
    headersMock.mockResolvedValue(new Headers());

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(runAutomatedEmailCronMock).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer undefined" }),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(runAutomatedEmailCronMock).not.toHaveBeenCalled();
  });

  it("returns the structured cron result", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runAutomatedEmailCronMock.mockResolvedValue({
      success: true,
      message: "No automated emails were due",
      stats: {
        enabled: true,
        now: "2026-04-19T00:00:00.000Z",
        sendHourLocal: 9,
        inactivityDays: 14,
        cooldownDays: 21,
        batchSize: 100,
        scannedUsers: 5,
        dueUsers: 0,
        weeklyDue: 0,
        reengagementDue: 0,
        skippedNoEmail: 0,
        skippedNoActivePositions: 0,
        skippedAlreadySent: 0,
        sent: 0,
        failed: 0,
        batchCount: 0,
        missingEnvVars: [],
      },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "No automated emails were due",
      stats: {
        enabled: true,
        now: "2026-04-19T00:00:00.000Z",
        sendHourLocal: 9,
        inactivityDays: 14,
        cooldownDays: 21,
        batchSize: 100,
        scannedUsers: 5,
        dueUsers: 0,
        weeklyDue: 0,
        reengagementDue: 0,
        skippedNoEmail: 0,
        skippedNoActivePositions: 0,
        skippedAlreadySent: 0,
        sent: 0,
        failed: 0,
        batchCount: 0,
        missingEnvVars: [],
      },
    });
    expect(runAutomatedEmailCronMock).toHaveBeenCalledTimes(1);
  });

  it("returns a 500 response when the cron runner throws", async () => {
    headersMock.mockResolvedValue(
      new Headers({ authorization: "Bearer test-cron-secret" }),
    );
    runAutomatedEmailCronMock.mockRejectedValue(new Error("boom"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "boom",
    });
  });
});
