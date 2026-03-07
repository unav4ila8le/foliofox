import { describe, expect, it } from "vitest";

import {
  buildCivilDateKeyRange,
  formatDateKeyInTimeZone,
  resolveTodayDateKey,
  toCivilDateKeyOrThrow,
} from "./date-utils";

describe("civil date helpers", () => {
  it("resolves the civil day in the provided timezone instead of UTC", () => {
    const instant = new Date("2026-02-28T23:30:00.000Z");

    expect(resolveTodayDateKey("UTC", instant)).toBe("2026-02-28");
    expect(resolveTodayDateKey("Asia/Seoul", instant)).toBe("2026-03-01");
    expect(formatDateKeyInTimeZone(instant, "America/Los_Angeles")).toBe(
      "2026-02-28",
    );
  });

  it("resolves the correct civil day across a DST spring-forward boundary", () => {
    // 2026-03-08 is the US spring-forward date: clocks skip 02:00 -> 03:00 EDT.
    // At 06:30 UTC the wall clock in New York is 01:30 EST (still Mar 8).
    const beforeSpring = new Date("2026-03-08T06:30:00.000Z");
    expect(resolveTodayDateKey("America/New_York", beforeSpring)).toBe(
      "2026-03-08",
    );

    // At 07:30 UTC the wall clock jumps to 03:30 EDT (still Mar 8).
    const afterSpring = new Date("2026-03-08T07:30:00.000Z");
    expect(resolveTodayDateKey("America/New_York", afterSpring)).toBe(
      "2026-03-08",
    );
  });

  it("resolves the correct civil day at timezone extremes (UTC+14 / UTC-12)", () => {
    // At exactly UTC midnight, UTC+14 is already 14:00 the same calendar day,
    // while UTC-12 is still the previous calendar day.
    const utcMidnight = new Date("2026-06-15T00:00:00.000Z");

    expect(resolveTodayDateKey("Pacific/Kiritimati", utcMidnight)).toBe(
      "2026-06-15",
    );
    expect(resolveTodayDateKey("Etc/GMT+12", utcMidnight)).toBe("2026-06-14");

    // 11:59 UTC -> Kiritimati is Jun 16 01:59, GMT+12 is Jun 14 23:59
    const lateUtc = new Date("2026-06-15T11:59:00.000Z");
    expect(resolveTodayDateKey("Pacific/Kiritimati", lateUtc)).toBe(
      "2026-06-16",
    );
    expect(resolveTodayDateKey("Etc/GMT+12", lateUtc)).toBe("2026-06-14");
  });

  it("builds inclusive civil ranges without skipping calendar days", () => {
    expect(
      buildCivilDateKeyRange(
        toCivilDateKeyOrThrow("2026-03-29"),
        toCivilDateKeyOrThrow("2026-03-31"),
      ),
    ).toEqual(["2026-03-29", "2026-03-30", "2026-03-31"]);
  });
});
