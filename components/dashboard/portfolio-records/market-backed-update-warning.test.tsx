import { type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpdateForm } from "@/components/dashboard/new-portfolio-record/forms/update-form";
import { UpdatePortfolioRecordForm } from "@/components/dashboard/portfolio-records/table/row-actions/update-dialog/form";

import type {
  PortfolioRecordWithPosition,
  TransformedPosition,
} from "@/types/global.types";

const dialogStateMock = vi.hoisted(() => ({
  preselectedPosition: null as TransformedPosition | null,
  setOpen: vi.fn(),
}));

const dashboardDataMock = vi.hoisted(() => ({
  refreshDashboardData: vi.fn(),
}));

const fetchSingleQuoteMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@/components/dashboard/providers/dashboard-data-provider", () => ({
  useDashboardData: () => ({
    refreshDashboardData: dashboardDataMock.refreshDashboardData,
  }),
}));

vi.mock("@/components/dashboard/new-portfolio-record/index", () => ({
  useNewPortfolioRecordDialog: () => dialogStateMock,
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchSingleQuote: fetchSingleQuoteMock,
}));

vi.mock("@/server/portfolio-records/create", () => ({
  createPortfolioRecord: vi.fn(),
}));

vi.mock("@/server/portfolio-records/update", () => ({
  updatePortfolioRecord: vi.fn(),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}));

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div>spinner</div>,
}));

vi.mock("@/components/ui/custom/dialog", () => ({
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/custom/localized-number-input", () => ({
  LocalizedNumberInput: ({
    value,
    onValueChange,
    ...props
  }: {
    value?: string | number | null;
    onValueChange?: (value: string) => void;
  }) => (
    <input
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/input-group", () => ({
  InputGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InputGroupAddon: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  InputGroupText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>select value</span>,
}));

function createPositionFixture(
  overrides: Partial<TransformedPosition> = {},
): TransformedPosition {
  return {
    id: "position-1",
    user_id: "user-1",
    name: "Apple Inc.",
    type: "asset",
    currency: "USD",
    symbol_id: "sym-aapl",
    domain_id: null,
    category_id: "category-1",
    description: null,
    archived_at: null,
    capital_gains_tax_rate: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_archived: false,
    current_quantity: 10,
    current_unit_value: 100,
    total_value: 1000,
    has_market_data: true,
    cost_basis_per_unit: 95,
    ...overrides,
  };
}

function createPortfolioRecordFixture(
  overrides: Partial<PortfolioRecordWithPosition> = {},
): PortfolioRecordWithPosition {
  return {
    id: "record-1",
    user_id: "user-1",
    position_id: "position-1",
    type: "update",
    date: "2026-01-02",
    quantity: 10,
    unit_value: 100,
    description: null,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    positions: {
      id: "position-1",
      name: "Apple Inc.",
      currency: "USD",
      type: "asset",
      archived_at: null,
      symbol_id: "sym-aapl",
    },
    position_snapshots: null,
    ...overrides,
  };
}

describe("Market-backed Update warning", () => {
  beforeEach(() => {
    dialogStateMock.preselectedPosition = null;
    dialogStateMock.setOpen.mockReset();
    dashboardDataMock.refreshDashboardData.mockReset();
    fetchSingleQuoteMock.mockReset();
    fetchSingleQuoteMock.mockResolvedValue(100);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the warning in the create Update form for symbol-backed positions", () => {
    dialogStateMock.preselectedPosition = createPositionFixture();

    render(<UpdateForm />);

    expect(
      screen.getByText(/Portfolio performance may be approximate\./i),
    ).toBeTruthy();
  });

  it("hides the warning in the create Update form for non-symbol positions", () => {
    dialogStateMock.preselectedPosition = createPositionFixture({
      symbol_id: null,
      has_market_data: false,
    });

    render(<UpdateForm />);

    expect(
      screen.queryByText(/Portfolio performance may be approximate\./i),
    ).toBeNull();
  });

  it("shows the warning in the edit dialog for symbol-backed update records", () => {
    render(
      <UpdatePortfolioRecordForm
        portfolioRecord={createPortfolioRecordFixture()}
      />,
    );

    expect(
      screen.getByText(/Portfolio performance may be approximate\./i),
    ).toBeTruthy();
  });

  it("hides the warning in the edit dialog for non-symbol positions", () => {
    render(
      <UpdatePortfolioRecordForm
        portfolioRecord={createPortfolioRecordFixture({
          positions: {
            id: "position-1",
            name: "Manual Asset",
            currency: "USD",
            type: "asset",
            archived_at: null,
            symbol_id: null,
          },
        })}
      />,
    );

    expect(
      screen.queryByText(/Portfolio performance may be approximate\./i),
    ).toBeNull();
  });
});
