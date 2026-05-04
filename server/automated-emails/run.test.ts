import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildAutomatedEmailDigestMock = vi.fn();
const sendAutomatedEmailMock = vi.fn();
const sendAutomatedEmailBatchMock = vi.fn();
const isAutomatedEmailDeliveryAlreadySentMock = vi.fn();
const fetchRecipientEmailsByUserIdMock = vi.fn();
const createAutomatedEmailSenderMock = vi.fn();
const evaluateAutomatedEmailScheduleMock = vi.fn();
const buildWeeklyRecapEmailTemplateMock = vi.fn();
const buildReengagementEmailTemplateMock = vi.fn();
const createServiceClientMock = vi.fn();

vi.mock("@/server/automated-emails/digest", () => ({
  buildAutomatedEmailDigest: buildAutomatedEmailDigestMock,
}));

vi.mock("@/server/automated-emails/deliveries", () => ({
  sendAutomatedEmail: sendAutomatedEmailMock,
  sendAutomatedEmailBatch: sendAutomatedEmailBatchMock,
  isAutomatedEmailDeliveryAlreadySent: isAutomatedEmailDeliveryAlreadySentMock,
}));

vi.mock("@/server/automated-emails/recipient-emails", () => ({
  fetchRecipientEmailsByUserId: fetchRecipientEmailsByUserIdMock,
}));

vi.mock("@/server/automated-emails/sender", () => ({
  createAutomatedEmailSender: createAutomatedEmailSenderMock,
}));

vi.mock("@/server/automated-emails/schedule", () => ({
  evaluateAutomatedEmailSchedule: evaluateAutomatedEmailScheduleMock,
}));

vi.mock("@/server/automated-emails/templates", () => ({
  buildWeeklyRecapEmailTemplate: buildWeeklyRecapEmailTemplateMock,
  buildReengagementEmailTemplate: buildReengagementEmailTemplateMock,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

interface FakeCandidateRow {
  user_id: string;
  weekly_recap_enabled: boolean;
  marketing_emails_enabled: boolean;
  profiles: {
    user_id: string;
    username: string;
    display_currency: string;
    time_zone: string;
    last_app_activity_at: string | null;
  } | null;
}

interface FakeServiceClientState {
  candidateRows: FakeCandidateRow[];
  recentReengagementRows: Array<{ user_id: string; sent_at: string | null }>;
}

function createFakeServiceClient(state: FakeServiceClientState) {
  return {
    from: (table: string) => {
      if (table === "email_preferences") {
        return {
          select: () =>
            Promise.resolve({
              data: state.candidateRows,
              error: null,
            }),
        };
      }

      if (table === "automated_email_deliveries") {
        const builder = {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          gte() {
            return this;
          },
          order() {
            return Promise.resolve({
              data: state.recentReengagementRows,
              error: null,
            });
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table in test stub: ${table}`);
    },
  };
}

function setRequiredAutomatedEmailEnvVars() {
  process.env.AUTOMATED_EMAILS_ENABLED = "true";
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.EMAILS_FROM_ADDRESS =
    "Foliofox <notifications@test.foliofox.com>";
  process.env.EMAIL_LINK_SECRET = "test-email-link-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://test.foliofox.com";
}

function clearAutomatedEmailEnvVars() {
  delete process.env.AUTOMATED_EMAILS_ENABLED;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAILS_FROM_ADDRESS;
  delete process.env.EMAIL_LINK_SECRET;
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

describe("runAutomatedEmailCron", () => {
  beforeEach(() => {
    clearAutomatedEmailEnvVars();

    buildAutomatedEmailDigestMock.mockReset();
    sendAutomatedEmailMock.mockReset();
    sendAutomatedEmailBatchMock.mockReset();
    isAutomatedEmailDeliveryAlreadySentMock.mockReset();
    fetchRecipientEmailsByUserIdMock.mockReset();
    createAutomatedEmailSenderMock.mockReset();
    evaluateAutomatedEmailScheduleMock.mockReset();
    buildWeeklyRecapEmailTemplateMock.mockReset();
    buildReengagementEmailTemplateMock.mockReset();
    createServiceClientMock.mockReset();

    isAutomatedEmailDeliveryAlreadySentMock.mockResolvedValue(false);
    sendAutomatedEmailBatchMock.mockResolvedValue([]);
    createAutomatedEmailSenderMock.mockReturnValue({
      sendEmail: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAutomatedEmailEnvVars();
  });

  it("returns a no-op result when AUTOMATED_EMAILS_ENABLED is not 'true'", async () => {
    process.env.AUTOMATED_EMAILS_ENABLED = "false";

    const { runAutomatedEmailCron } = await import("./run");
    const result = await runAutomatedEmailCron(
      new Date("2026-04-20T13:00:00.000Z"),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Automated emails are disabled");
    expect(result.stats.enabled).toBe(false);
    expect(result.stats.scannedUsers).toBe(0);
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailMock).not.toHaveBeenCalled();
  });

  it("returns a no-op result when required env vars are missing", async () => {
    process.env.AUTOMATED_EMAILS_ENABLED = "true";
    // Intentionally omit the other required env vars.

    const { runAutomatedEmailCron } = await import("./run");
    const result = await runAutomatedEmailCron(
      new Date("2026-04-20T13:00:00.000Z"),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "Automated emails skipped because configuration is incomplete",
    );
    expect(result.stats.missingEnvVars).toEqual(
      expect.arrayContaining([
        "RESEND_API_KEY",
        "EMAILS_FROM_ADDRESS",
        "EMAIL_LINK_SECRET",
        "NEXT_PUBLIC_SITE_URL",
      ]),
    );
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailMock).not.toHaveBeenCalled();
  });

  it("sends a weekly recap and short-circuits already-sent users before building the digest", async () => {
    setRequiredAutomatedEmailEnvVars();

    const candidateRows: FakeCandidateRow[] = [
      {
        user_id: "user-due",
        weekly_recap_enabled: true,
        marketing_emails_enabled: true,
        profiles: {
          user_id: "user-due",
          username: "Alice",
          display_currency: "USD",
          time_zone: "America/New_York",
          last_app_activity_at: null,
        },
      },
      {
        user_id: "user-already-sent",
        weekly_recap_enabled: true,
        marketing_emails_enabled: true,
        profiles: {
          user_id: "user-already-sent",
          username: "Bob",
          display_currency: "USD",
          time_zone: "America/New_York",
          last_app_activity_at: null,
        },
      },
      {
        user_id: "user-not-due",
        weekly_recap_enabled: true,
        marketing_emails_enabled: true,
        profiles: {
          user_id: "user-not-due",
          username: "Carol",
          display_currency: "USD",
          time_zone: "America/New_York",
          last_app_activity_at: null,
        },
      },
    ];

    createServiceClientMock.mockReturnValue(
      createFakeServiceClient({
        candidateRows,
        recentReengagementRows: [],
      }),
    );

    // Walk through candidateRows in order so the schedule decision matches
    // each user; this avoids leaking userIds into the schedule mock signature.
    let candidateIndex = 0;
    evaluateAutomatedEmailScheduleMock.mockImplementation(() => {
      const userId = candidateRows[candidateIndex]?.user_id;
      candidateIndex += 1;

      if (userId === "user-not-due") {
        return {
          weeklyRecapDue: false,
          reengagementDue: false,
          selectedEmailType: null,
          deliveryKey: null,
          localDateKey: "2026-04-20",
          localHour: 13,
        };
      }

      return {
        weeklyRecapDue: true,
        reengagementDue: false,
        selectedEmailType: "weekly_recap" as const,
        deliveryKey: "weekly:2026-04-20",
        localDateKey: "2026-04-20",
        localHour: 9,
      };
    });

    isAutomatedEmailDeliveryAlreadySentMock.mockImplementation(
      ({ userId }: { userId: string }) => {
        return Promise.resolve(userId === "user-already-sent");
      },
    );

    fetchRecipientEmailsByUserIdMock.mockResolvedValue(
      new Map([
        ["user-due", "alice@test.foliofox.com"],
        ["user-already-sent", "bob@test.foliofox.com"],
      ]),
    );

    buildAutomatedEmailDigestMock.mockResolvedValue({
      eligible: true,
      digest: {
        userId: "user-due",
        currency: "USD",
        activePositionCount: 3,
        netWorth: {
          asOfDateKey: "2026-04-20",
          comparisonDateKey: "2026-04-13",
          currentValue: 1100,
          previousValue: 1000,
          absoluteChange: 100,
          percentageChange: 10,
        },
        topMovers: null,
        projectedIncome: null,
      },
    });

    buildWeeklyRecapEmailTemplateMock.mockResolvedValue({
      subject: "Your Foliofox weekly recap",
      html: "<html>recap</html>",
      text: "recap",
      links: {
        dashboardUrl: "https://test.foliofox.com/dashboard",
        settingsUrl: "https://test.foliofox.com/dashboard?settings=emails",
        unsubscribeUrl: "https://test.foliofox.com/unsubscribe?token=x",
      },
    });

    sendAutomatedEmailBatchMock.mockResolvedValue([
      {
        success: true,
        skipped: false,
        deliveryRecordId: "delivery-1",
        providerMessageId: "provider-1",
      },
    ]);

    const { runAutomatedEmailCron } = await import("./run");
    const result = await runAutomatedEmailCron(
      new Date("2026-04-20T13:00:00.000Z"),
    );

    expect(result.success).toBe(true);
    expect(result.stats.scannedUsers).toBe(3);
    expect(result.stats.dueUsers).toBe(2);
    expect(result.stats.weeklyDue).toBe(2);
    expect(result.stats.reengagementDue).toBe(0);
    expect(result.stats.sent).toBe(1);
    expect(result.stats.skippedAlreadySent).toBe(1);
    expect(result.stats.failed).toBe(0);
    expect(result.stats.batchCount).toBe(1);

    // Already-sent user must not trigger digest construction or template
    // rendering — the early dedupe check should skip them entirely.
    expect(buildAutomatedEmailDigestMock).toHaveBeenCalledTimes(1);
    expect(buildWeeklyRecapEmailTemplateMock).toHaveBeenCalledTimes(1);
    expect(buildAutomatedEmailDigestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ user_id: "user-due" }),
      }),
    );
    expect(sendAutomatedEmailMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailBatchMock).toHaveBeenCalledTimes(1);
    expect(sendAutomatedEmailBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            userId: "user-due",
            emailType: "weekly_recap",
            deliveryKey: "weekly:2026-04-20",
          }),
        ],
      }),
    );
  });

  it("counts no-active-positions users as skipped without sending", async () => {
    setRequiredAutomatedEmailEnvVars();

    createServiceClientMock.mockReturnValue(
      createFakeServiceClient({
        candidateRows: [
          {
            user_id: "user-empty-portfolio",
            weekly_recap_enabled: true,
            marketing_emails_enabled: false,
            profiles: {
              user_id: "user-empty-portfolio",
              username: "Empty",
              display_currency: "USD",
              time_zone: "America/New_York",
              last_app_activity_at: null,
            },
          },
        ],
        recentReengagementRows: [],
      }),
    );

    evaluateAutomatedEmailScheduleMock.mockReturnValue({
      weeklyRecapDue: true,
      reengagementDue: false,
      selectedEmailType: "weekly_recap" as const,
      deliveryKey: "weekly:2026-04-20",
      localDateKey: "2026-04-20",
      localHour: 9,
    });

    fetchRecipientEmailsByUserIdMock.mockResolvedValue(
      new Map([["user-empty-portfolio", "empty@test.foliofox.com"]]),
    );

    buildAutomatedEmailDigestMock.mockResolvedValue({
      eligible: false,
      reason: "no_active_positions",
    });

    const { runAutomatedEmailCron } = await import("./run");
    const result = await runAutomatedEmailCron(
      new Date("2026-04-20T13:00:00.000Z"),
    );

    expect(result.stats.skippedNoActivePositions).toBe(1);
    expect(result.stats.sent).toBe(0);
    expect(sendAutomatedEmailMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ items: [] }),
    );
    expect(buildWeeklyRecapEmailTemplateMock).not.toHaveBeenCalled();
  });

  it("counts users with no resolvable email address as skipped without building the digest", async () => {
    setRequiredAutomatedEmailEnvVars();

    createServiceClientMock.mockReturnValue(
      createFakeServiceClient({
        candidateRows: [
          {
            user_id: "user-no-email",
            weekly_recap_enabled: true,
            marketing_emails_enabled: false,
            profiles: {
              user_id: "user-no-email",
              username: "Ghost",
              display_currency: "USD",
              time_zone: "America/New_York",
              last_app_activity_at: null,
            },
          },
        ],
        recentReengagementRows: [],
      }),
    );

    evaluateAutomatedEmailScheduleMock.mockReturnValue({
      weeklyRecapDue: true,
      reengagementDue: false,
      selectedEmailType: "weekly_recap" as const,
      deliveryKey: "weekly:2026-04-20",
      localDateKey: "2026-04-20",
      localHour: 9,
    });

    fetchRecipientEmailsByUserIdMock.mockResolvedValue(new Map());

    const { runAutomatedEmailCron } = await import("./run");
    const result = await runAutomatedEmailCron(
      new Date("2026-04-20T13:00:00.000Z"),
    );

    expect(result.stats.skippedNoEmail).toBe(1);
    expect(result.stats.sent).toBe(0);
    expect(buildAutomatedEmailDigestMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailMock).not.toHaveBeenCalled();
    expect(sendAutomatedEmailBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ items: [] }),
    );
  });
});
