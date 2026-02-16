import { describe, expect, it } from "vitest";

import { normalizeChartQuoteEntries } from "./utils";

describe("normalizeChartQuoteEntries", () => {
  it("returns sorted entries with both close and adjusted close prices", () => {
    const result = normalizeChartQuoteEntries({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00Z"),
          close: 250.12,
          adjclose: 249.01,
        },
        {
          date: new Date("2026-02-13T00:00:00Z"),
          close: 251.34,
          adjclose: 250.9,
        },
      ],
    });

    expect(result).toEqual([
      {
        dateKey: "2026-02-13",
        closePrice: 251.34,
        adjustedClosePrice: 250.9,
      },
      {
        dateKey: "2026-02-14",
        closePrice: 250.12,
        adjustedClosePrice: 249.01,
      },
    ]);
  });

  it("falls back adjusted close to close when adjclose is missing", () => {
    const result = normalizeChartQuoteEntries({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00Z"),
          close: 250.12,
          adjclose: null,
        },
      ],
    });

    expect(result).toEqual([
      {
        dateKey: "2026-02-14",
        closePrice: 250.12,
        adjustedClosePrice: 250.12,
      },
    ]);
  });

  it("falls back adjusted close to close when adjclose is non-positive", () => {
    const result = normalizeChartQuoteEntries({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00Z"),
          close: 250.12,
          adjclose: 0,
        },
      ],
    });

    expect(result).toEqual([
      {
        dateKey: "2026-02-14",
        closePrice: 250.12,
        adjustedClosePrice: 250.12,
      },
    ]);
  });

  it("filters out entries missing a valid close price", () => {
    const result = normalizeChartQuoteEntries({
      quotes: [
        {
          date: new Date("2026-02-14T00:00:00Z"),
          close: null,
          adjclose: 249.01,
        },
        {
          date: null,
          close: 251.34,
          adjclose: 250.9,
        },
      ],
    });

    expect(result).toEqual([]);
  });
});
