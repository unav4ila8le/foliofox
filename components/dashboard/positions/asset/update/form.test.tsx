import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UpdateAssetForm } from "./form";

import type { Position } from "@/types/global.types";

vi.mock("@/components/dashboard/categories/position-category-selector", () => ({
  PositionCategorySelector: () => <div>Category selector</div>,
}));

vi.mock(
  "@/components/dashboard/positions/shared/capital-gains-tax-rate-field",
  () => ({
    CapitalGainsTaxRateField: () => <div>Capital gains tax rate</div>,
  }),
);

vi.mock("@/components/dashboard/positions/shared/update-symbol-dialog", () => ({
  UpdateSymbolDialog: () => null,
}));

vi.mock("@/server/positions/update", () => ({
  updatePosition: vi.fn(),
}));

function createPosition(): Position {
  return {
    id: "position-1",
    name: "Manual Asset",
    type: "asset",
    category_id: "equity",
    user_category_id: null,
    capital_gains_tax_rate: null,
    idempotency_key: null,
    description: null,
    symbol_id: null,
    currency: "EUR",
    quantity: 1,
    unit_value: 10,
    cost_basis_per_unit: 10,
    domain_id: null,
    source_hub_id: null,
    archived_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    user_id: "user-1",
  } as Position;
}

describe("UpdateAssetForm", () => {
  it("shows Link Symbol for positions without a current ticker", () => {
    render(<UpdateAssetForm position={createPosition()} />);

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByText("Link Ticker Symbol")).toBeDefined();
    expect(screen.getByRole("button", { name: "Link Symbol" })).toBeDefined();
  });
});
