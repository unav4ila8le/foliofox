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
} from "@/components/ui/sidebar";
import { User } from "./user";
import { Branding } from "./branding";
import { Menu } from "./menu";

import type { Profile } from "@/types/global.types";

export function DashboardSidebar({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <UISidebarMenu>
          <SidebarMenuItem>
            <User profile={profile} email={email} />
          </SidebarMenuItem>
        </UISidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
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
