import { Sidebar, SidebarRail } from "@/components/ui/custom/sidebar";
import { Chat } from "./chat";

export function RightSidebar() {
  return (
    <Sidebar
      side="right"
      showMobileClose
      mobileBreakpoint="(max-width: 1279px)"
    >
      <Chat />
      <SidebarRail side="right" />
    </Sidebar>
  );
}
