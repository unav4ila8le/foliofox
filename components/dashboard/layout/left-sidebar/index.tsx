import type { CSSProperties } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/custom/sidebar";
import { Branding } from "./branding";
import { HelpButton } from "./help";
import { Menu } from "./menu";
import { User } from "./user";

export function LeftSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      style={{ "--sidebar-width-mobile": "max(18rem, 64vw)" } as CSSProperties}
    >
      {/* Header */}
      <SidebarHeader>
        <User />
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <Menu />
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="gap-8">
        <HelpButton />
        <Branding />
      </SidebarFooter>
    </Sidebar>
  );
}
