import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type React from "react";

import { RightSidebar } from "@/components/dashboard/layout/right-sidebar";

const hoistedMocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  openRight: true,
  openMobileRight: false,
  setOpenRight: vi.fn(
    (value: boolean | ((previousValue: boolean) => boolean)) => {
      hoistedMocks.openRight =
        typeof value === "function" ? value(hoistedMocks.openRight) : value;
    },
  ),
  setOpenMobileRight: vi.fn(
    (value: boolean | ((previousValue: boolean) => boolean)) => {
      hoistedMocks.openMobileRight =
        typeof value === "function"
          ? value(hoistedMocks.openMobileRight)
          : value;
    },
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hoistedMocks.pathname,
}));

vi.mock("@/components/dashboard/layout/right-sidebar/ai-advisor", () => ({
  AIAdvisor: () => <div data-testid="ai-advisor" />,
}));

vi.mock("@/components/ui/custom/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="right-sidebar">{children}</div>
  ),
  SidebarRail: () => <div data-testid="right-sidebar-rail" />,
  useSidebar: () => ({
    openRight: hoistedMocks.openRight,
    openMobileRight: hoistedMocks.openMobileRight,
    setOpenRight: hoistedMocks.setOpenRight,
    setOpenMobileRight: hoistedMocks.setOpenMobileRight,
  }),
}));

describe("RightSidebar", () => {
  beforeEach(() => {
    cleanup();
    hoistedMocks.pathname = "/dashboard";
    hoistedMocks.openRight = true;
    hoistedMocks.openMobileRight = false;
    hoistedMocks.setOpenRight.mockClear();
    hoistedMocks.setOpenMobileRight.mockClear();
  });

  it("renders the sidebar outside /dashboard/ai-chat", () => {
    render(<RightSidebar />);

    expect(screen.getByTestId("right-sidebar")).not.toBeNull();
    expect(screen.getByTestId("ai-advisor")).not.toBeNull();
  });

  it("hides the sidebar and forces closed state on /dashboard/ai-chat", () => {
    hoistedMocks.pathname = "/dashboard/ai-chat";
    hoistedMocks.openMobileRight = true;

    render(<RightSidebar />);

    expect(screen.queryByTestId("right-sidebar")).toBeNull();
    expect(hoistedMocks.setOpenRight).toHaveBeenCalledWith(false);
    expect(hoistedMocks.setOpenMobileRight).toHaveBeenCalledWith(false);
  });

  it("restores previous right-sidebar open state after leaving /dashboard/ai-chat", () => {
    const { rerender } = render(<RightSidebar />);

    hoistedMocks.pathname = "/dashboard/ai-chat";
    hoistedMocks.openMobileRight = true;
    rerender(<RightSidebar />);

    hoistedMocks.setOpenRight.mockClear();
    hoistedMocks.setOpenMobileRight.mockClear();
    hoistedMocks.pathname = "/dashboard/assets";
    rerender(<RightSidebar />);

    expect(hoistedMocks.setOpenRight).toHaveBeenCalledWith(true);
    expect(hoistedMocks.setOpenMobileRight).toHaveBeenCalledWith(true);
  });

  it("suppresses Ctrl/Cmd+I while on /dashboard/ai-chat", () => {
    hoistedMocks.pathname = "/dashboard/ai-chat";

    render(<RightSidebar />);

    const event = new KeyboardEvent("keydown", {
      key: "i",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
