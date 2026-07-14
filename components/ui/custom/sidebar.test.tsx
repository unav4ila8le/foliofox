import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider, useSidebar } from "@/components/ui/custom/sidebar";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

function OpenStates() {
  const { openLeft, openRight } = useSidebar();
  return <div data-testid="open-states">{`${openLeft}:${openRight}`}</div>;
}

describe("SidebarProvider mobile mount collapse", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("collapses both sides after mount on mobile viewports without writing cookies", () => {
    stubMatchMedia(true);

    render(
      <SidebarProvider>
        <OpenStates />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("open-states").textContent).toBe("false:false");
    expect(document.cookie).not.toContain("sidebar_left_state");
    expect(document.cookie).not.toContain("sidebar_right_state");
  });

  it("keeps default open state on desktop viewports", () => {
    stubMatchMedia(false);

    render(
      <SidebarProvider defaultOpen defaultOpenRight>
        <OpenStates />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("open-states").textContent).toBe("true:true");
  });
});
