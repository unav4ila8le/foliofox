import { describe, expect, it } from "vitest";

import { applyPortfolioRecordTransition } from "./recalculate";

import type { PortfolioRecord } from "@/types/global.types";

function buildRecord(options: {
  type: PortfolioRecord["type"];
  quantity: number;
  unitValue: number;
  id?: string;
}): Pick<PortfolioRecord, "id" | "type" | "quantity" | "unit_value"> {
  return {
    id: options.id ?? "record-1",
    type: options.type,
    quantity: options.quantity,
    unit_value: options.unitValue,
  };
}

describe("applyPortfolioRecordTransition", () => {
  it("applies weighted cost basis for consecutive buys", () => {
    const firstBuy = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "buy", quantity: 10, unitValue: 100 }),
      runningQuantity: 0,
      runningCostBasis: 0,
    });

    const secondBuy = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "buy", quantity: 5, unitValue: 200 }),
      runningQuantity: firstBuy.runningQuantity,
      runningCostBasis: firstBuy.runningCostBasis,
    });

    expect(firstBuy).toEqual({
      runningQuantity: 10,
      runningCostBasis: 100,
    });
    expect(secondBuy.runningQuantity).toBe(15);
    expect(secondBuy.runningCostBasis).toBeCloseTo(133.333333, 6);
  });

  it("decreases quantity on sell and keeps cost basis unchanged", () => {
    const result = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "sell", quantity: 4, unitValue: 150 }),
      runningQuantity: 10,
      runningCostBasis: 120,
    });

    expect(result).toEqual({
      runningQuantity: 6,
      runningCostBasis: 120,
    });
  });

  it("resets quantity and cost basis on update, with optional override", () => {
    const withoutOverride = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "update", quantity: 8, unitValue: 90 }),
      runningQuantity: 10,
      runningCostBasis: 120,
    });

    const withOverride = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "update", quantity: 8, unitValue: 90 }),
      runningQuantity: 10,
      runningCostBasis: 120,
      overrideCostBasisPerUnit: 75,
    });

    expect(withoutOverride).toEqual({
      runningQuantity: 8,
      runningCostBasis: 90,
    });
    expect(withOverride).toEqual({
      runningQuantity: 8,
      runningCostBasis: 75,
    });
  });

  it("clamps oversell quantity to zero", () => {
    const result = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "sell", quantity: 12, unitValue: 100 }),
      runningQuantity: 5,
      runningCostBasis: 80,
    });

    expect(result).toEqual({
      runningQuantity: 0,
      runningCostBasis: 80,
    });
  });
});
