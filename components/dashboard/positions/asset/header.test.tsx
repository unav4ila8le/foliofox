import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/locale/resolve-locale", () => ({
  getRequestLocale: vi.fn().mockResolvedValue("en-US"),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./edit-asset-button", () => ({
  EditAssetButton: () => null,
}));

vi.mock("./asset-more-actions-button", () => ({
  AssetMoreActionsButton: () => null,
}));

vi.mock("@/components/dashboard/positions/asset/stale-badge", () => ({
  StaleBadge: () => null,
}));

import { AssetHeader } from "./header";

import type { PositionWithProfitLoss } from "@/types/global.types";

function createPositionWithProfitLoss(): PositionWithProfitLoss {
  return {
    id: "pos-1",
    user_id: "user-1",
    type: "asset",
    name: "Test Asset",
    currency: "USD",
    category_id: "stocks",
    capital_gains_tax_rate: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    symbol_id: "sym-1",
    domain_id: null,
    description: null,
    is_archived: false,
    category_name: "Stocks",
    current_quantity: 10,
    current_unit_value: 125,
    total_value: 1250,
    has_market_data: true,
    cost_basis_per_unit: 100,
    total_cost_basis: 1000,
    profit_loss: 250,
    profit_loss_percentage: 0.25,
  };
}

describe("AssetHeader", () => {
  it("shows separate unrealized and realized profit/loss labels", async () => {
    const position = createPositionWithProfitLoss();
    const view = render(
      await AssetHeader({
        position,
        symbol: null,
        positionWithProfitLoss: position,
        realizedProfitLoss: 400,
      }),
    );

    expect(screen.getByText("Unrealized P/L")).toBeTruthy();
    expect(screen.getByText("Realized P/L")).toBeTruthy();
    expect(screen.queryByText("P/L (%)")).toBeNull();
    expect(view.container.textContent).toContain("25.00%");
  });
});
