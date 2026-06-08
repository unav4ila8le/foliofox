import { beforeEach, describe, expect, it, vi } from "vitest";

import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import type { TransformedPosition } from "@/types/global.types";

const fetchPositionsMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();

vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: fetchPositionsMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: vi.fn(),
}));

const createPosition = (
  overrides: Partial<TransformedPosition> = {},
): TransformedPosition => ({
  id: "pos-1",
  user_id: "user-1",
  name: "Test Asset",
  currency: "USD",
  symbol_id: null,
  type: "asset",
  category_id: "equity",
  user_category_id: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
  description: null,
  domain_id: null,
  archived_at: null,
  is_archived: false,
  category_name: "Equity",
  user_category_name: null,
  display_category_id: "equity",
  display_category_name: "Equity",
  is_custom_category: false,
  symbol_ticker: null,
  current_quantity: 1,
  current_unit_value: 100,
  total_value: 100,
  has_market_data: false,
  capital_gains_tax_rate: null,
  ...overrides,
});

describe("calculateAssetAllocation", () => {
  beforeEach(() => {
    fetchPositionsMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    fetchExchangeRatesMock.mockResolvedValue(new Map());
  });

  it("groups custom categories by display category instead of system other", async () => {
    const asOfDateKey = toCivilDateKeyOrThrow("2026-01-15");
    fetchPositionsMock.mockResolvedValue([
      createPosition({
        id: "system-other",
        name: "System Other",
        category_id: "other",
        category_name: "Others",
        display_category_id: "other",
        display_category_name: "Others",
        total_value: 100,
      }),
      createPosition({
        id: "custom-category",
        name: "Wine Collection",
        category_id: "other",
        user_category_id: "custom-1",
        category_name: "Others",
        user_category_name: "Wine Collection",
        display_category_id: "custom-1",
        display_category_name: "Wine Collection",
        is_custom_category: true,
        total_value: 250,
      }),
    ]);

    const { calculateAssetAllocation } =
      await import("@/server/analysis/asset-allocation");

    const result = await calculateAssetAllocation("USD", asOfDateKey);

    expect(result).toEqual([
      {
        category_id: "custom-1",
        name: "Wine Collection",
        total_value: 250,
      },
      {
        category_id: "other",
        name: "Others",
        total_value: 100,
      },
    ]);
  });
});
