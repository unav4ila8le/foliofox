import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransformedPosition } from "@/types/global.types";

const fetchProfileMock = vi.fn();
const fetchFinancialProfileMock = vi.fn();
const fetchPositionsMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();
const resolveSymbolsBatchMock = vi.fn();
const calculateAssetAllocationMock = vi.fn();
const calculateNetWorthMock = vi.fn();

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

vi.mock("@/server/financial-profiles/actions", () => ({
  fetchFinancialProfile: fetchFinancialProfileMock,
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: fetchPositionsMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolsBatch: resolveSymbolsBatchMock,
}));

vi.mock("@/server/analysis/asset-allocation", () => ({
  calculateAssetAllocation: calculateAssetAllocationMock,
}));

vi.mock("@/server/analysis/net-worth/net-worth", () => ({
  calculateNetWorth: calculateNetWorthMock,
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
  current_unit_value: 500,
  total_value: 500,
  has_market_data: false,
  capital_gains_tax_rate: null,
  ...overrides,
});

describe("getPortfolioOverview", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    fetchFinancialProfileMock.mockReset();
    fetchPositionsMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    resolveSymbolsBatchMock.mockReset();
    calculateAssetAllocationMock.mockReset();
    calculateNetWorthMock.mockReset();

    fetchProfileMock.mockResolvedValue({
      profile: {
        display_currency: "USD",
        time_zone: "UTC",
      },
    });
    fetchFinancialProfileMock.mockResolvedValue(null);
    fetchExchangeRatesMock.mockResolvedValue(new Map());
    resolveSymbolsBatchMock.mockResolvedValue({ byInput: new Map() });
  });

  it("uses display categories in AI portfolio overview output", async () => {
    fetchPositionsMock.mockResolvedValue([createPosition()]);
    calculateAssetAllocationMock.mockResolvedValue([
      {
        category_id: "custom-1",
        name: "Wine Collection",
        total_value: 500,
      },
    ]);

    const { getPortfolioOverview } =
      await import("@/server/ai/tools/portfolio-overview");

    const result = await getPortfolioOverview({
      baseCurrency: "USD",
      date: "2026-01-15",
      includeAfterTax: false,
    });

    expect(result.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "Wine Collection",
          categoryId: "custom-1",
        }),
      ]),
    );
    expect(result.categories).toEqual([
      {
        id: "custom-1",
        name: "Wine Collection",
        percentage: 100,
        value: 500,
      },
    ]);
  });
});
