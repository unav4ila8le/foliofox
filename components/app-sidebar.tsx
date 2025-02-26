import Link from "next/link";
import { Home, TrendingUp, CreditCard } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/ui/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Avatar className="size-10">
            <AvatarImage src="https://github.com/shadcn.png" alt="john doe" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text font-semibold">John Doe</p>
            <span className="text-muted-foreground text-sm">1,000,000 EUR</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
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
        <Logo height={24} />
        <p className="text-muted-foreground text-center text-xs">
          Copyright © {new Date().getFullYear()}. All rights reserved.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
