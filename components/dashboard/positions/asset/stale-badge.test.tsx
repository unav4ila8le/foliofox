import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useDashboardDataMock } = vi.hoisted(() => ({
  useDashboardDataMock: vi.fn(),
}));

vi.mock("@/components/dashboard/providers/dashboard-data-provider", () => ({
  useDashboardData: useDashboardDataMock,
}));

vi.mock("@/components/ui/custom/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/dashboard/positions/shared/update-symbol-dialog", () => ({
  UpdateSymbolDialog: ({ open }: { open: boolean }) =>
    open ? <div>Update symbol flow</div> : null,
}));

vi.mock("@/components/dashboard/positions/shared/archive-dialog", () => ({
  ArchivePositionDialog: ({
    open,
    positions,
  }: {
    open: boolean;
    positions: Array<{ name: string }>;
  }) => (open ? <div>Archive {positions[0]?.name}</div> : null),
}));

import { StaleBadge } from "./stale-badge";

describe("StaleBadge", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useDashboardDataMock.mockReturnValue({
      marketDataStatuses: [
        {
          positionId: "position-1",
          positionName: "Old Holding",
          ticker: "OLD",
          status: "unavailable",
        },
      ],
    });
  });

  it("renders icon-only in table rows when no label is passed", () => {
    render(<StaleBadge positionId="position-1" />);

    expect(screen.queryByText("No market data")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Market data unavailable" }),
    ).toBeTruthy();
  });

  it("offers symbol-update and archive paths for unavailable market data", () => {
    render(<StaleBadge positionId="position-1" label="Stale" />);

    expect(screen.getByText("No market data")).toBeTruthy();
    expect(
      screen.getByText(/No live price — showing the last saved value/),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Market data unavailable" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "OLD market data is unavailable",
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Change Ticker Symbol" }),
    );
    expect(screen.getByText("Update symbol flow")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Market data unavailable" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive Position" }));
    expect(screen.getByText("Archive Old Holding")).toBeTruthy();
  });

  it("keeps the yellow stale treatment with its own tooltip", () => {
    useDashboardDataMock.mockReturnValue({
      marketDataStatuses: [
        {
          positionId: "position-1",
          positionName: "Live Holding",
          ticker: "LIVE",
          status: "stale",
        },
      ],
    });

    render(<StaleBadge positionId="position-1" label="Stale" />);

    expect(screen.getByText("Stale")).toBeTruthy();
    expect(
      screen.getByText(/Price data hasn't updated in over 7 days/),
    ).toBeTruthy();
  });
});
