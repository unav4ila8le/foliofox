"use client";

import { MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuButton, useSidebar } from "@/components/ui/custom/sidebar";
import { UserMenu } from "@/components/dashboard/layout/left-sidebar/user/user-menu";
import { usePrivacyMode } from "@/components/dashboard/providers/privacy-mode-provider";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

import { formatCurrency } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";

export function User() {
  const { profile, netWorth } = useDashboardData();
  const { isMobile } = useSidebar();
  const { isPrivacyMode } = usePrivacyMode();
  const locale = useLocale();

  const avatarUrl = profile?.avatar_url || undefined;
  const username = profile?.username || "User";
  const initial = username.slice(0, 1);

  return (
    <UserMenu menuSide={isMobile ? "bottom" : "right"} menuAlign="start">
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-2"
      >
        <Avatar className="size-10 group-data-[state=collapsed]:size-8">
          <AvatarImage src={avatarUrl} alt={username} />
          <AvatarFallback className="uppercase">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text truncate font-semibold">{username}</p>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {isPrivacyMode
              ? "* * * * * * * *"
              : formatCurrency(netWorth, profile.display_currency, { locale })}
          </span>
        </div>
        <MoreVertical className="ml-auto size-4" />
      </SidebarMenuButton>
    </UserMenu>
  );
}
