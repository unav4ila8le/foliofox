import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransformedPosition } from "@/types/global.types";

const mocks = vi.hoisted(() => ({
  calculateUnrealizedProfitLoss: vi.fn(),
  fetchPositions: vi.fn(),
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: mocks.fetchPositions,
}));

vi.mock("@/lib/profit-loss/unrealized", () => ({
  calculateUnrealizedProfitLoss: mocks.calculateUnrealizedProfitLoss,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

const createPosition = (
  overrides: Partial<TransformedPosition> = {},
): TransformedPosition => ({
  id: "pos-1",
  user_id: "user-1",
  name: "Wine Collection",
  currency: "USD",
  symbol_id: null,
  type: "asset",
  category_id: "other",
  user_category_id: "custom-1",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  description: null,
  domain_id: null,
  archived_at: null,
  is_archived: false,
  category_name: "Others",
  user_category_name: "Wine Collection",
  display_category_id: "custom-1",
  display_category_name: "Wine Collection",
  is_custom_category: true,
  symbol_ticker: null,
  current_quantity: 1,
  current_unit_value: 5000,
  total_value: 5000,
  has_market_data: false,
  capital_gains_tax_rate: null,
  ...overrides,
});

describe("exportPositions", () => {
  beforeEach(() => {
    mocks.calculateUnrealizedProfitLoss.mockReset();
    mocks.fetchPositions.mockReset();
  });

  it("exports canonical category_id and user_category", async () => {
    const position = createPosition();
    mocks.fetchPositions.mockResolvedValue({
      positions: [position],
      snapshots: new Map(),
    });
    mocks.calculateUnrealizedProfitLoss.mockReturnValue([
      {
        ...position,
        cost_basis_per_unit: null,
        total_cost_basis: null,
        profit_loss: null,
        profit_loss_percentage: null,
      },
    ]);

    const { exportPositions } = await import("@/server/positions/export");

    const result = await exportPositions("asset");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const [headers, row] = result.data.split("\n");
    expect(headers.split(",").slice(0, 3)).toEqual([
      "name",
      "category_id",
      "user_category",
    ]);
    expect(row.split(",").slice(0, 3)).toEqual([
      "Wine Collection",
      "other",
      "Wine Collection",
    ]);
  });
});
