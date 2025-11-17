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

import type { FinancialProfile, Profile } from "@/types/global.types";

export function LeftSidebar({
  profile,
  email,
  financialProfile,
  netWorth,
}: {
  profile: Profile;
  email: string;
  financialProfile?: FinancialProfile | null;
  netWorth: number;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <UISidebarMenu>
          <SidebarMenuItem>
            <User
              profile={profile}
              email={email}
              financialProfile={financialProfile}
              netWorth={netWorth}
            />
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
