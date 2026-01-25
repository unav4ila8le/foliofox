import { describe, it, expect } from "vitest";

import { calculateProfitLoss } from "./profit-loss";

import type {
  TransformedPosition,
  PositionSnapshot,
} from "@/types/global.types";

// HELPER: Mock Data Generators
// We use these simple helpers to create test data without cluttering the tests
// with massive JSON objects.

function createPosition(
  id: string,
  currentQuantity: number,
  totalValue: number,
): TransformedPosition {
  return {
    id,
    current_quantity: currentQuantity,
    total_value: totalValue,
    // defaults for required fields we don't care about for P/L math
    name: "Test Asset",
    currency: "USD",
    type: "asset",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    user_id: "user-1",
    category_id: "cat-1",
    is_archived: false,
    current_unit_value: currentQuantity > 0 ? totalValue / currentQuantity : 0,
    has_market_data: true,
    symbol_id: null,
    domain_id: null,
    description: null,
    archived_at: null,
  };
}

function createSnapshot(
  id: string,
  date: string,
  costBasis: number | null,
  unitValue: number = 100,
): PositionSnapshot {
  return {
    id,
    date,
    cost_basis_per_unit: costBasis,
    unit_value: unitValue,
    created_at: date, // simplify by matching date
    // defaults
    position_id: "pos-1",
    quantity: 10,
    portfolio_record_id: null,
    updated_at: date,
    user_id: "user-1",
  };
}

describe("calculateProfitLoss", () => {
  // 1. Basic Scenarios
  it("returns 0 for everything if there are no snapshots", () => {
    const position = createPosition("pos-1", 10, 1000);
    const snapshots = new Map<string, PositionSnapshot[]>();

    const [result] = calculateProfitLoss([position], snapshots);

    expect(result.profit_loss).toBe(0);
    expect(result.profit_loss_percentage).toBe(0);
    expect(result.total_cost_basis).toBe(0);
    expect(result.cost_basis_per_unit).toBe(0);
  });

  it("calculates profit correctly when value goes UP", () => {
    // Bought at $100/unit. Now worth $1500 (so $150/unit)
    const position = createPosition("pos-1", 10, 1500);
    const snapshot = createSnapshot("snap-1", "2024-01-01", 100);
    const snapshots = new Map([["pos-1", [snapshot]]]);

    const [result] = calculateProfitLoss([position], snapshots);

    // Cost Basis: 10 * 100 = 1000
    // Current Value: 1500
    // Profit: 500
    expect(result.total_cost_basis).toBe(1000);
    expect(result.profit_loss).toBe(500);
    expect(result.profit_loss_percentage).toBe(0.5); // 50%
  });

  it("calculates loss correctly when value goes DOWN", () => {
    // Bought at $100/unit. Now worth $500 (so $50/unit)
    const position = createPosition("pos-1", 10, 500);
    const snapshot = createSnapshot("snap-1", "2024-01-01", 100);
    const snapshots = new Map([["pos-1", [snapshot]]]);

    const [result] = calculateProfitLoss([position], snapshots);

    // Cost Basis: 10 * 100 = 1000
    // Current Value: 500
    // Loss: -500
    expect(result.total_cost_basis).toBe(1000);
    expect(result.profit_loss).toBe(-500);
    expect(result.profit_loss_percentage).toBe(-0.5); // -50%
  });

  // 2. Snapshot Selection Logic
  // The function must pick the "correct" snapshot to determine cost basis.
  it("uses the most recent snapshot as the source of truth", () => {
    const position = createPosition("pos-1", 10, 2000);

    // Old snapshot: low cost basis
    const oldSnap = createSnapshot("snap-1", "2023-01-01", 50);
    // New snapshot: high cost basis (maybe we bought more)
    const newSnap = createSnapshot("snap-2", "2024-01-01", 150);

    const snapshots = new Map([["pos-1", [oldSnap, newSnap]]]);

    const [result] = calculateProfitLoss([position], snapshots);

    // Should use $150 basis from 2024
    // Basis: 10 * 150 = 1500
    // Value: 2000
    // Profit: 500
    expect(result.cost_basis_per_unit).toBe(150);
    expect(result.total_cost_basis).toBe(1500);
    expect(result.profit_loss).toBe(500);
  });

  it("skips recent snapshots if they have null cost basis (fallback logic)", () => {
    const position = createPosition("pos-1", 10, 2000);

    // 1. Old, has basis ($100)
    const oldSnap = createSnapshot("snap-1", "2024-01-01", 100);
    // 2. Newer, but basis is null (maybe just a price update)
    const priceUpdateSnap = createSnapshot("snap-2", "2024-02-01", null);

    const snapshots = new Map([["pos-1", [oldSnap, priceUpdateSnap]]]);

    const [result] = calculateProfitLoss([position], snapshots);

    // It should look back and find the $100 basis
    expect(result.cost_basis_per_unit).toBe(100);
  });

  // 3. Fallback Logic
  it("falls back to unit_value if cost_basis_per_unit is never found", () => {
    const position = createPosition("pos-1", 10, 1200);

    // Snapshot has NO explicit cost basis, but has a unit_value of 100
    const snapshot = createSnapshot("snap-1", "2024-01-01", null, 100);

    const snapshots = new Map([["pos-1", [snapshot]]]);
    const [result] = calculateProfitLoss([position], snapshots);

    // Should assume the unit_value (100) is the basis
    expect(result.cost_basis_per_unit).toBe(100);
    expect(result.total_cost_basis).toBe(1000);
  });

  it("handles zero quantity gracefully", () => {
    const position = createPosition("pos-1", 0, 0); // Sold everything
    const snapshot = createSnapshot("snap-1", "2024-01-01", 100);

    const snapshots = new Map([["pos-1", [snapshot]]]);
    const [result] = calculateProfitLoss([position], snapshots);

    expect(result.total_cost_basis).toBe(0);
    expect(result.profit_loss).toBe(0);
  });
});
