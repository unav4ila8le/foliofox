import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type React from "react";

import { AIChatToggle } from "@/components/dashboard/layout/header/ai-chat-toggle";

const hoistedMocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  toggleRight: vi.fn(),
  openRight: false,
  openMobileRight: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hoistedMocks.pathname,
}));

vi.mock("@/components/ui/custom/sidebar", () => ({
  useSidebar: () => ({
    toggleRight: hoistedMocks.toggleRight,
    openRight: hoistedMocks.openRight,
    openMobileRight: hoistedMocks.openMobileRight,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/kbd", () => ({
  Kbd: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  KbdGroup: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe("AIChatToggle", () => {
  beforeEach(() => {
    cleanup();
    hoistedMocks.pathname = "/dashboard";
    hoistedMocks.openRight = false;
    hoistedMocks.openMobileRight = false;
    hoistedMocks.toggleRight.mockClear();
  });

  it("renders the AI Advisor toggle outside the full-page AI chat route", () => {
    hoistedMocks.pathname = "/dashboard/assets";

    render(<AIChatToggle />);

    expect(screen.getByRole("button", { name: "AI Advisor" })).not.toBeNull();
  });

  it("hides the AI Advisor toggle on /dashboard/ai-chat", () => {
    hoistedMocks.pathname = "/dashboard/ai-chat";

    render(<AIChatToggle />);

    expect(screen.queryByRole("button", { name: "AI Advisor" })).toBeNull();
  });

  it("hides the AI Advisor toggle when the advisor sidebar is open", () => {
    hoistedMocks.pathname = "/dashboard/assets";
    hoistedMocks.openRight = true;

    render(<AIChatToggle />);

    expect(screen.queryByRole("button", { name: "AI Advisor" })).toBeNull();
  });
});
