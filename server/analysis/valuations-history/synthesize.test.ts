import { describe, expect, it } from "vitest";

import {
  synthesizeDailyValuationsByPosition,
  toDateKeyFromUTCDate,
} from "@/server/analysis/valuations-history/synthesize";
import { parseUTCDateKey } from "@/lib/date/date-utils";

describe("synthesizeDailyValuationsByPosition", () => {
  it("skips rows before first snapshot and carries values forward for non-market positions", () => {
    const result = synthesizeDailyValuationsByPosition({
      positions: [
        {
          id: "pos-1",
          snapshots: [
            {
              date: "2026-01-03",
              quantity: 2,
              unitValue: 50,
              costBasisPerUnit: 45,
            },
          ],
        },
      ],
      startDate: parseUTCDateKey("2026-01-01"),
      endDate: parseUTCDateKey("2026-01-05"),
    });

    const rows = result.get("pos-1") ?? [];
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.dateKey)).toEqual([
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
    expect(rows.every((row) => row.unitValue === 50)).toBe(true);
    expect(rows.every((row) => row.priceSource === "snapshot")).toBe(true);
  });

  it("overrides snapshot value with market value when available and falls back otherwise", () => {
    const marketPrices = new Map<string, number>([
      ["pos-1|2026-01-03", 120],
      ["pos-1|2026-01-05", 130],
    ]);

    const result = synthesizeDailyValuationsByPosition({
      positions: [
        {
          id: "pos-1",
          snapshots: [
            {
              date: "2026-01-03",
              quantity: 1.5,
              unitValue: 100,
              costBasisPerUnit: 95,
            },
          ],
        },
      ],
      startDate: parseUTCDateKey("2026-01-03"),
      endDate: parseUTCDateKey("2026-01-05"),
      marketPricesByPositionDate: marketPrices,
    });

    const rows = result.get("pos-1") ?? [];
    expect(rows.map((row) => row.unitValue)).toEqual([120, 100, 130]);
    expect(rows.map((row) => row.priceSource)).toEqual([
      "market",
      "snapshot",
      "market",
    ]);
  });

  it("keeps zero-quantity rows after full exit by default", () => {
    const result = synthesizeDailyValuationsByPosition({
      positions: [
        {
          id: "pos-1",
          snapshots: [
            {
              id: "buy-1",
              date: "2026-01-02",
              createdAt: "2026-01-02T09:00:00.000Z",
              quantity: 3,
              unitValue: 100,
              costBasisPerUnit: 100,
            },
            {
              id: "sell-1",
              date: "2026-01-04",
              createdAt: "2026-01-04T09:00:00.000Z",
              quantity: 0,
              unitValue: 102,
              costBasisPerUnit: 100,
            },
          ],
        },
      ],
      startDate: parseUTCDateKey("2026-01-02"),
      endDate: parseUTCDateKey("2026-01-06"),
    });

    const rows = result.get("pos-1") ?? [];
    expect(rows.map((row) => [row.dateKey, row.quantity])).toEqual([
      ["2026-01-02", 3],
      ["2026-01-03", 3],
      ["2026-01-04", 0],
      ["2026-01-05", 0],
      ["2026-01-06", 0],
    ]);
  });

  it("uses deterministic same-day ordering (date, createdAt, id)", () => {
    const result = synthesizeDailyValuationsByPosition({
      positions: [
        {
          id: "pos-1",
          snapshots: [
            {
              id: "b-buy",
              date: "2026-01-03",
              createdAt: "2026-01-03T10:00:00.000Z",
              quantity: 5,
              unitValue: 101,
              costBasisPerUnit: 101,
            },
            {
              id: "a-sell",
              date: "2026-01-03",
              createdAt: "2026-01-03T10:00:00.000Z",
              quantity: 2,
              unitValue: 99,
              costBasisPerUnit: 101,
            },
          ],
        },
      ],
      startDate: parseUTCDateKey("2026-01-03"),
      endDate: parseUTCDateKey("2026-01-03"),
    });

    const rows = result.get("pos-1") ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].unitValue).toBe(101);
  });

  it("applies per-position end date caps", () => {
    const result = synthesizeDailyValuationsByPosition({
      positions: [
        {
          id: "pos-1",
          snapshots: [
            {
              date: "2026-01-01",
              quantity: 1,
              unitValue: 10,
            },
          ],
        },
      ],
      startDate: parseUTCDateKey("2026-01-01"),
      endDate: parseUTCDateKey("2026-01-05"),
      endDateKeyByPosition: new Map([["pos-1", "2026-01-03"]]),
    });

    const rows = result.get("pos-1") ?? [];
    expect(rows.map((row) => row.dateKey)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });
});

describe("toDateKeyFromUTCDate", () => {
  it("normalizes to UTC date key", () => {
    const key = toDateKeyFromUTCDate(new Date("2026-01-10T23:12:59.000Z"));
    expect(key).toBe("2026-01-10");
  });
});
