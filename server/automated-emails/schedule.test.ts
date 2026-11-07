import { describe, expect, it } from "vitest";

import {
  evaluateAutomatedEmailSchedule,
  resolveWeeklyRecapWeekday,
} from "./schedule";

// The trailing 8 hex digits pick the weekday, so `…0000000N` maps to N % 7.
const SUNDAY_USER_ID = "4f9c2d1e-7b3a-4c5d-9e8f-000000000000";
const MONDAY_USER_ID = "4f9c2d1e-7b3a-4c5d-9e8f-000000000001";
const WEDNESDAY_USER_ID = "4f9c2d1e-7b3a-4c5d-9e8f-000000000003";

describe("evaluateAutomatedEmailSchedule", () => {
  it("marks weekly recap due at 9 AM local time on the user's weekday", () => {
    const result = evaluateAutomatedEmailSchedule({
      userId: MONDAY_USER_ID,
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
      userId: MONDAY_USER_ID,
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
      userId: MONDAY_USER_ID,
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
      userId: MONDAY_USER_ID,
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

  it("maps the trailing user-ID hex to a fixed weekday", () => {
    const weekdays = Array.from({ length: 7 }, (_, offset) =>
      resolveWeeklyRecapWeekday(`4f9c2d1e-7b3a-4c5d-9e8f-00000000000${offset}`),
    );

    expect(weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(
      resolveWeeklyRecapWeekday("4f9c2d1e-7b3a-4c5d-9e8f-0000ffffffff"),
    ).toBe(0xffffffff % 7);
  });

  it("sends the weekly recap on exactly one day per week", () => {
    // 2026-04-19 is a Sunday; 13:00 UTC is 9 AM in New York (EDT).
    const dueDateKeys = Array.from({ length: 7 }, (_, offset) =>
      evaluateAutomatedEmailSchedule({
        userId: WEDNESDAY_USER_ID,
        timeZone: "America/New_York",
        weeklyRecapEnabled: true,
        marketingEmailsEnabled: false,
        lastAppActivityAt: null,
        lastReengagementSentAt: null,
        now: new Date(Date.UTC(2026, 3, 19 + offset, 13)),
      }),
    )
      .filter((result) => result.weeklyRecapDue)
      .map((result) => result.localDateKey);

    expect(dueDateKeys).toEqual(["2026-04-22"]);
  });

  it("uses the user's local weekday, not the UTC weekday", () => {
    // Monday 9 AM in Kiritimati (UTC+14) is still Sunday 19:00 UTC.
    const now = new Date("2026-04-19T19:00:00.000Z");
    const scheduleInput = {
      timeZone: "Pacific/Kiritimati",
      weeklyRecapEnabled: true,
      marketingEmailsEnabled: false,
      lastAppActivityAt: null,
      lastReengagementSentAt: null,
      now,
    };

    expect(
      evaluateAutomatedEmailSchedule({
        ...scheduleInput,
        userId: MONDAY_USER_ID,
      }),
    ).toMatchObject({
      localDateKey: "2026-04-20",
      weeklyRecapDue: true,
      deliveryKey: "weekly:2026-04-20",
    });
    expect(
      evaluateAutomatedEmailSchedule({
        ...scheduleInput,
        userId: SUNDAY_USER_ID,
      }).weeklyRecapDue,
    ).toBe(false);
  });
});
