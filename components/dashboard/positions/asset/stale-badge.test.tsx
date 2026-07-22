import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("offers symbol-update and archive paths for unavailable market data", () => {
    render(<StaleBadge positionId="position-1" label="Stale" />);

    expect(screen.getByText("Market data unavailable")).toBeTruthy();
    expect(
      screen.getByText(
        /Change the ticker if it moved, or archive the position/,
      ),
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
});
