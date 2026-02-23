import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type React from "react";

import { AIChatToggle } from "@/components/dashboard/layout/header/ai-chat-toggle";

const hoistedMocks = vi.hoisted(() => ({
  pathname: "/dashboard",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hoistedMocks.pathname,
}));

vi.mock("@/components/ui/custom/sidebar", () => ({
  SidebarTrigger: ({
    side,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    side?: "left" | "right";
  }) => (
    <button
      aria-label={side === "right" ? "Toggle AI Chat" : "Toggle Sidebar"}
      {...props}
    />
  ),
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
  });

  it("renders the right toggle outside the full-page AI chat route", () => {
    hoistedMocks.pathname = "/dashboard/assets";

    render(<AIChatToggle />);

    expect(
      screen.getByRole("button", { name: "Toggle AI Chat" }),
    ).not.toBeNull();
  });

  it("hides the right toggle on /dashboard/ai-chat", () => {
    hoistedMocks.pathname = "/dashboard/ai-chat";

    render(<AIChatToggle />);

    expect(screen.queryByRole("button", { name: "Toggle AI Chat" })).toBeNull();
  });
});
