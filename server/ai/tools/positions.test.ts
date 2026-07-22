import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransformedPosition } from "@/types/global.types";

const fetchProfileMock = vi.fn();
const fetchPositionsMock = vi.fn();
const resolveSymbolsBatchMock = vi.fn();

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

vi.mock("@/server/positions/fetch", () => ({
  fetchPositions: fetchPositionsMock,
}));

vi.mock("@/server/positions/resolve-position-lookup", () => ({
  resolvePositionLookup: vi.fn(),
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolsBatch: resolveSymbolsBatchMock,
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
  idempotency_key: null,
  ...overrides,
});

describe("getPositions", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    fetchPositionsMock.mockReset();
    resolveSymbolsBatchMock.mockReset();

    fetchProfileMock.mockResolvedValue({
      profile: {
        time_zone: "UTC",
      },
    });
    resolveSymbolsBatchMock.mockResolvedValue({ byInput: new Map() });
  });

  it("returns canonical category_id and separate display category fields", async () => {
    fetchPositionsMock.mockResolvedValue([
      createPosition({ symbol_id: "sym-1" }),
    ]);

    const { getPositions } = await import("@/server/ai/tools/positions");

    const result = await getPositions({
      positionIds: null,
      date: "2026-01-15",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        category_id: "other",
        category: "Wine Collection",
        display_category_id: "custom-1",
      }),
    ]);
    expect(resolveSymbolsBatchMock).toHaveBeenCalledWith(["sym-1"], {
      provider: "yahoo",
      providerType: "ticker",
      providerAliasMode: "display-fallback",
      onError: "warn",
    });
  });
});
