import { describe, expect, it } from "vitest";

import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import { calculateTimeWeightedReturnSeries } from "./time-weighted-return";

describe("calculateTimeWeightedReturnSeries", () => {
  it("rebases the first valid point to 0% and compounds days with no flows", () => {
    const result = calculateTimeWeightedReturnSeries([
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-01"),
        totalValue: 100,
        netFlow: 0,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-02"),
        totalValue: 110,
        netFlow: 0,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-03"),
        totalValue: 121,
        netFlow: 0,
      },
    ]);

    expect(result[0]).toEqual({
      dateKey: toCivilDateKeyOrThrow("2026-01-01"),
      cumulativeReturnPct: 0,
    });
    expect(result[1]?.cumulativeReturnPct).toBeCloseTo(10, 10);
    expect(result[2]?.cumulativeReturnPct).toBeCloseTo(21, 10);
  });

  it("handles positive flows with the start-of-day contribution assumption", () => {
    const result = calculateTimeWeightedReturnSeries([
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-01"),
        totalValue: 100,
        netFlow: 0,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-02"),
        totalValue: 210,
        netFlow: 100,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-03"),
        totalValue: 231,
        netFlow: 0,
      },
    ]);

    expect(result[0]).toEqual({
      dateKey: toCivilDateKeyOrThrow("2026-01-01"),
      cumulativeReturnPct: 0,
    });
    expect(result[1]?.cumulativeReturnPct).toBeCloseTo(5, 10);
    expect(result[2]?.cumulativeReturnPct).toBeCloseTo(15.5, 10);
  });

  it("handles negative flows and keeps zero-exposure days flat", () => {
    const result = calculateTimeWeightedReturnSeries([
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-01"),
        totalValue: 200,
        netFlow: 0,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-02"),
        totalValue: 105,
        netFlow: -100,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-03"),
        totalValue: 0,
        netFlow: -120,
      },
      {
        dateKey: toCivilDateKeyOrThrow("2026-01-04"),
        totalValue: 0,
        netFlow: 0,
      },
    ]);

    expect(result[0]).toEqual({
      dateKey: toCivilDateKeyOrThrow("2026-01-01"),
      cumulativeReturnPct: 0,
    });
    expect(result[1]?.cumulativeReturnPct).toBeCloseTo(5, 10);
    expect(result[2]?.cumulativeReturnPct).toBeCloseTo(5, 10);
    expect(result[3]?.cumulativeReturnPct).toBeCloseTo(5, 10);
  });
});
