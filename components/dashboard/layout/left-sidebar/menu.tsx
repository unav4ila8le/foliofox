"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  GitBranch,
  Home,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/custom/sidebar";

// Menu group interface
interface MenuGroup {
  label: string;
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    badge?: string;
  }[];
}

// Menu groups
const menuGroups: MenuGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Home", url: "/dashboard", icon: Home },
      { title: "Assets", url: "/dashboard/assets", icon: TrendingUp },
      {
        title: "Portfolio Records",
        url: "/dashboard/portfolio-records",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "AI Advisor", url: "/dashboard/ai-chat", icon: Sparkles },
      {
        title: "Scenario Planning",
        url: "/dashboard/planning/scenario",
        icon: GitBranch,
        badge: "Beta",
      },
    ],
  },
];

export function Menu() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      {menuGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={
                      pathname === item.url
                        ? "bg-background hover:bg-background text-foreground shadow"
                        : "text-muted-foreground"
                    }
                  >
                    <Link href={item.url} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <div className="flex w-full min-w-0 items-center gap-2">
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <Badge className="bg-brand/10 text-brand ml-auto flex-none">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
