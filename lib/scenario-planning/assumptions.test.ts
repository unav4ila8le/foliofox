import { describe, expect, test } from "vitest";

import { ld } from "@/lib/date/date-utils";

import { makeScenario, runScenario } from "./index";

describe("scenario planning deterministic assumptions", () => {
  test("applies expected annual return as monthly compounded growth", () => {
    const scenario = makeScenario({
      name: "Growth only",
      events: [],
    });

    const result = runScenario({
      scenario,
      startDate: ld(2026, 1, 1),
      endDate: ld(2026, 3, 1),
      initialValue: 1200,
      assumptions: {
        expectedAnnualReturnPercent: 12,
      },
    });

    const monthlyGrowthRate = Math.pow(1 + 0.12, 1 / 12) - 1;
    const expectedJanuary = 1200 * (1 + monthlyGrowthRate);
    const expectedFebruary = expectedJanuary * (1 + monthlyGrowthRate);
    const expectedMarch = expectedFebruary * (1 + monthlyGrowthRate);

    expect(result.balance["2026-01"]).toBeCloseTo(expectedJanuary, 6);
    expect(result.balance["2026-02"]).toBeCloseTo(expectedFebruary, 6);
    expect(result.balance["2026-03"]).toBeCloseTo(expectedMarch, 6);
  });

  test("does not apply growth when expected annual return is missing", () => {
    const scenario = makeScenario({
      name: "No assumptions",
      events: [],
    });

    const result = runScenario({
      scenario,
      startDate: ld(2026, 1, 1),
      endDate: ld(2026, 2, 1),
      initialValue: 5000,
    });

    expect(result.balance["2026-01"]).toBe(5000);
    expect(result.balance["2026-02"]).toBe(5000);
  });

  test("caps extreme negative return at full capital loss", () => {
    const scenario = makeScenario({
      name: "Extreme loss",
      events: [],
    });

    const result = runScenario({
      scenario,
      startDate: ld(2026, 1, 1),
      endDate: ld(2026, 3, 1),
      initialValue: 5000,
      assumptions: {
        expectedAnnualReturnPercent: -100,
      },
    });

    expect(result.balance["2026-01"]).toBe(0);
    expect(result.balance["2026-02"]).toBe(0);
    expect(result.balance["2026-03"]).toBe(0);
  });

  test("ignores non-finite expected annual return values", () => {
    const scenario = makeScenario({
      name: "Invalid assumptions",
      events: [],
    });

    const nanResult = runScenario({
      scenario,
      startDate: ld(2026, 1, 1),
      endDate: ld(2026, 2, 1),
      initialValue: 5000,
      assumptions: {
        expectedAnnualReturnPercent: Number.NaN,
      },
    });

    const infinityResult = runScenario({
      scenario,
      startDate: ld(2026, 1, 1),
      endDate: ld(2026, 2, 1),
      initialValue: 5000,
      assumptions: {
        expectedAnnualReturnPercent: Number.POSITIVE_INFINITY,
      },
    });

    expect(nanResult.balance["2026-01"]).toBe(5000);
    expect(nanResult.balance["2026-02"]).toBe(5000);
    expect(infinityResult.balance["2026-01"]).toBe(5000);
    expect(infinityResult.balance["2026-02"]).toBe(5000);
  });
});
