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
  netWorth,
}: {
  profile: Profile;
  email: string;
  netWorth: number;
}) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <UISidebarMenu>
          <SidebarMenuItem>
            <User profile={profile} email={email} netWorth={netWorth} />
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
