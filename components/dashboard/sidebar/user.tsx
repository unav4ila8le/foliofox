"use client";

import { useState } from "react";
import { LogOut, MoreVertical, Settings } from "lucide-react";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { SettingsForm } from "@/components/dashboard/sidebar/settings-form";

import { signout } from "@/lib/auth/actions";
import { formatCurrency } from "@/lib/number";

interface UserProps {
  avatar_url: string;
  username: string;
  net_worth: number;
}

export function User({ avatar_url, username, net_worth }: UserProps) {
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
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-2"
          >
            <Avatar className="size-10">
              <AvatarImage src={avatar_url} alt={username.toLowerCase()} />
              <AvatarFallback>
                {username
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text truncate font-semibold">{username}</p>
              <span className="text-muted-foreground truncate text-xs">
                {formatCurrency(net_worth, "USD")}
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
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem onSelect={handleSignOut} disabled={isLoading}>
            <LogOut className="size-4" />
            {isLoading ? "Signing out..." : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Change here your profile information
          </DialogDescription>
        </DialogHeader>
        <SettingsForm />
      </DialogContent>
    </Dialog>
  );
}
