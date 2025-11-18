import { Sidebar, SidebarRail } from "@/components/ui/custom/sidebar";
import { Chat } from "./chat";

import type { Profile } from "@/types/global.types";

export function RightSidebar({ profile }: { profile: Profile }) {
  return (
    <Sidebar
      side="right"
      showMobileClose
      mobileBreakpoint="(max-width: 1279px)"
    >
      <Chat profile={profile} />
      <SidebarRail side="right" />
    </Sidebar>
  );
}
