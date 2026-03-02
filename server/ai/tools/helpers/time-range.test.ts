import { describe, expect, it } from "vitest";

import {
  clampDateRange,
  clampDaysBack,
  DEFAULT_MAX_HISTORY_DAYS,
} from "@/server/ai/tools/helpers/time-range";
import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

describe("clampDaysBack", () => {
  it("defaults and bounds values", () => {
    expect(clampDaysBack({ requested: null })).toBe(DEFAULT_MAX_HISTORY_DAYS);
    expect(clampDaysBack({ requested: 0 })).toBe(1);
    expect(clampDaysBack({ requested: 9999 })).toBe(DEFAULT_MAX_HISTORY_DAYS);
  });
});

describe("clampDateRange", () => {
  it("clamps future end dates to provided civil today", () => {
    const todayDateKey = toCivilDateKeyOrThrow("2026-03-02");

    const range = clampDateRange({
      startDate: "2026-02-25",
      endDate: "2026-03-10",
      todayDateKey,
    });

    expect(range).toEqual({
      startDate: "2026-02-25",
      endDate: "2026-03-02",
    });
  });

  it("enforces max lookback window", () => {
    const todayDateKey = toCivilDateKeyOrThrow("2026-03-02");

    const range = clampDateRange({
      startDate: "2025-01-01",
      endDate: "2026-03-02",
      maxDays: 30,
      todayDateKey,
    });

    expect(range).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-03-02",
    });
  });
});
