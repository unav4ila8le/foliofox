import type { CSSProperties } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu as UISidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/custom/sidebar";
import { User } from "./user";
import { Branding } from "./branding";
import { Menu } from "./menu";

export function LeftSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      style={{ "--sidebar-width-mobile": "max(18rem, 80vw)" } as CSSProperties}
    >
      <SidebarHeader>
        <UISidebarMenu>
          <SidebarMenuItem>
            <User />
          </SidebarMenuItem>
        </UISidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <Menu />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Branding />
      </SidebarFooter>
    </Sidebar>
  );
}
