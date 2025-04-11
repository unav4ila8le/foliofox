"use client";

import { useState } from "react";
import { LogOut, MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

import { signout } from "@/lib/auth/actions";
import { formatCurrency } from "@/lib/number";

interface UserProps {
  avatarUrl: string;
  name: string;
  netWorth: number;
}

export function User({ avatarUrl, name, netWorth }: UserProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { isMobile } = useSidebar();

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signout("local");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-2"
        >
          <Avatar className="size-10">
            <AvatarImage src={avatarUrl} alt={name.toLowerCase()} />
            <AvatarFallback>
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text truncate font-semibold">{name}</p>
            <span className="text-muted-foreground truncate text-xs">
              {formatCurrency(netWorth, "USD")}
            </span>
          </div>
          <MoreVertical className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)] md:w-auto md:min-w-56"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuItem onSelect={handleSignOut} disabled={isLoading}>
          <LogOut className="size-4" />
          {isLoading ? "Signing out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
