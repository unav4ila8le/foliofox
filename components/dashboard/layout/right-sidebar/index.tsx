import { Sidebar, SidebarRail } from "@/components/ui/custom/sidebar";
import { AIAdvisor } from "./ai-advisor";

export function RightSidebar() {
  return (
    <Sidebar
      side="right"
      showCloseButton
      mobileBreakpoint="(max-width: 1279px)"
    >
      <AIAdvisor />
      <SidebarRail side="right" />
    </Sidebar>
  );
}
