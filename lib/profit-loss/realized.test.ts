import { describe, expect, it } from "vitest";

import {
  calculateRealizedProfitLossTotals,
  type RealizedProfitLossSellRecord,
} from "./realized";

function createSellRecord(
  overrides: Partial<RealizedProfitLossSellRecord> = {},
): RealizedProfitLossSellRecord {
  return {
    positionId: "pos-1",
    quantity: 1,
    unitValue: 100,
    costBasisPerUnit: 90,
    ...overrides,
  };
}

describe("calculateRealizedProfitLossTotals", () => {
  it("returns an empty map when there are no sell records", () => {
    const result = calculateRealizedProfitLossTotals([]);

    expect(result.size).toBe(0);
  });

  it("calculates realized profit for a partial sell using weighted-average basis", () => {
    const result = calculateRealizedProfitLossTotals([
      createSellRecord({
        quantity: 50,
        unitValue: 120,
        costBasisPerUnit: 90,
      }),
    ]);

    expect(result.get("pos-1")).toBe(1500);
  });

  it("aggregates multiple sell records by position", () => {
    const result = calculateRealizedProfitLossTotals([
      createSellRecord({
        positionId: "pos-1",
        quantity: 2,
        unitValue: 110,
        costBasisPerUnit: 80,
      }),
      createSellRecord({
        positionId: "pos-1",
        quantity: 1,
        unitValue: 95,
        costBasisPerUnit: 80,
      }),
      createSellRecord({
        positionId: "pos-2",
        quantity: 3,
        unitValue: 75,
        costBasisPerUnit: 70,
      }),
    ]);

    expect(result.get("pos-1")).toBe(75);
    expect(result.get("pos-2")).toBe(15);
  });

  it("ignores sell records without cost basis", () => {
    const result = calculateRealizedProfitLossTotals([
      createSellRecord({
        quantity: 5,
        unitValue: 120,
        costBasisPerUnit: null,
      }),
      createSellRecord({
        quantity: 5,
        unitValue: 120,
        costBasisPerUnit: 100,
      }),
    ]);

    expect(result.get("pos-1")).toBe(100);
  });
});
