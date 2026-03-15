import { describe, expect, it } from "vitest";

import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import { resolveDaysBackForRange } from "./time-range";

describe("resolveDaysBackForRange", () => {
  it("computes YTD from the civil date without UTC shifting", () => {
    expect(
      resolveDaysBackForRange("ytd", toCivilDateKeyOrThrow("2026-01-02")),
    ).toBe(2);
  });

  it("clamps month-end ranges using civil calendar math", () => {
    expect(
      resolveDaysBackForRange("1m", toCivilDateKeyOrThrow("2026-03-31")),
    ).toBe(32);
  });

  it("clamps leap-day yearly ranges using civil calendar math", () => {
    expect(
      resolveDaysBackForRange("1y", toCivilDateKeyOrThrow("2024-02-29")),
    ).toBe(367);
  });
});
