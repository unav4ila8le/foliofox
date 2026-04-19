import { describe, expect, it } from "vitest";

import { evaluateAutomatedEmailSchedule } from "./schedule";

describe("evaluateAutomatedEmailSchedule", () => {
  it("marks weekly recap due on Monday at 9 AM local time", () => {
    const result = evaluateAutomatedEmailSchedule({
      timeZone: "America/New_York",
      weeklyRecapEnabled: true,
      marketingEmailsEnabled: false,
      lastAppActivityAt: null,
      lastReengagementSentAt: null,
      now: new Date("2026-04-20T13:00:00.000Z"),
    });

    expect(result).toMatchObject({
      localDateKey: "2026-04-20",
      localHour: 9,
      weeklyRecapDue: true,
      reengagementDue: false,
      selectedEmailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
    });
  });

  it("marks reengagement due after fourteen inactive local days at 9 AM", () => {
    const result = evaluateAutomatedEmailSchedule({
      timeZone: "Asia/Seoul",
      weeklyRecapEnabled: false,
      marketingEmailsEnabled: true,
      lastAppActivityAt: "2026-04-05T08:00:00.000Z",
      lastReengagementSentAt: null,
      now: new Date("2026-04-19T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      localDateKey: "2026-04-19",
      localHour: 9,
      weeklyRecapDue: false,
      reengagementDue: true,
      selectedEmailType: "reengagement",
      deliveryKey: "reengagement:2026-04-19",
    });
  });

  it("suppresses reengagement during the 21-day cooldown window", () => {
    const result = evaluateAutomatedEmailSchedule({
      timeZone: "Asia/Seoul",
      weeklyRecapEnabled: false,
      marketingEmailsEnabled: true,
      lastAppActivityAt: "2026-04-01T08:00:00.000Z",
      lastReengagementSentAt: "2026-04-10T00:00:00.000Z",
      now: new Date("2026-04-19T00:00:00.000Z"),
    });

    expect(result.selectedEmailType).toBeNull();
    expect(result.reengagementDue).toBe(false);
  });

  it("lets weekly recap win when both automations would otherwise be due", () => {
    const result = evaluateAutomatedEmailSchedule({
      timeZone: "America/New_York",
      weeklyRecapEnabled: true,
      marketingEmailsEnabled: true,
      lastAppActivityAt: "2026-04-05T12:00:00.000Z",
      lastReengagementSentAt: null,
      now: new Date("2026-04-20T13:00:00.000Z"),
    });

    expect(result).toMatchObject({
      weeklyRecapDue: true,
      reengagementDue: false,
      selectedEmailType: "weekly_recap",
    });
  });
});
