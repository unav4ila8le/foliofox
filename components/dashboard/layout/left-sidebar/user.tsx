"use client";

import { MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuButton, useSidebar } from "@/components/ui/custom/sidebar";
import { UserMenu } from "@/components/features/user/user-menu";
import { usePrivacyMode } from "@/components/dashboard/privacy-mode-provider";

import { formatCurrency } from "@/lib/number-format";

import type { Profile } from "@/types/global.types";

export function User({
  profile,
  email,
  netWorth,
}: {
  profile: Profile;
  email: string;
  netWorth: number;
}) {
  const { isMobile } = useSidebar();
  const { isPrivacyMode } = usePrivacyMode();

  const avatarUrl = profile?.avatar_url || undefined;
  const username = profile?.username || "User";
  const initial = username.slice(0, 1);

  return (
    <UserMenu
      profile={profile}
      email={email}
      menuSide={isMobile ? "bottom" : "right"}
      menuAlign="end"
    >
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
              : formatCurrency(netWorth, profile.display_currency)}
          </span>
        </div>
        <MoreVertical className="ml-auto size-4" />
      </SidebarMenuButton>
    </UserMenu>
  );
}
