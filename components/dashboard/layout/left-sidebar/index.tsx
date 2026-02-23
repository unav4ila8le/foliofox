import type { CSSProperties } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/custom/sidebar";
import { User } from "./user";
import { Branding } from "./branding";
import { Menu } from "./menu";

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
      <SidebarFooter>
        <Branding />
      </SidebarFooter>
    </Sidebar>
  );
}
