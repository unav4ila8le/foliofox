import type { CSSProperties } from "react";

import { Sidebar, SidebarRail } from "@/components/ui/custom/sidebar";
import { AIAdvisor } from "./ai-advisor";

export function RightSidebar() {
  return (
    <Sidebar
      side="right"
      showCloseButton
      mobileBreakpoint="(max-width: 1279px)"
      style={{ "--sidebar-width-mobile": "100vw" } as CSSProperties}
    >
      <AIAdvisor />
      <SidebarRail side="right" />
    </Sidebar>
  );
}
