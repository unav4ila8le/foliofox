"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Newspaper } from "lucide-react";

import {
  SidebarMenu as UISidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Menu items
const items = [
  {
    title: "Home",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Holdings",
    url: "/dashboard/holdings",
    icon: TrendingUp,
  },
  {
    title: "News",
    url: "/dashboard/news",
    icon: Newspaper,
  },
];

export function Menu() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <UISidebarMenu>
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
    </UISidebarMenu>
  );
}
