"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, CreditCard } from "lucide-react";
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { User } from "./user";
import { Branding } from "./branding";

import type { Profile } from "@/types/global.types";

// Placeholder menu items
const items = [
  {
    title: "Home",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Assets",
    url: "/dashboard/assets",
    icon: TrendingUp,
  },
  {
    title: "Liabilities",
    url: "/dashboard/liabilities",
    icon: CreditCard,
  },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <UISidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <User profile={profile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={
                      pathname === item.url
                        ? "bg-background hover:bg-background text-primary shadow"
                        : "text-muted-foreground"
                    }
                  >
                    <Link href={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Branding />
      </SidebarFooter>
    </UISidebar>
  );
}
