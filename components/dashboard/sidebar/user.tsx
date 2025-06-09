"use client";

import { useState } from "react";
import { LoaderCircle, LogOut, MoreVertical, Settings } from "lucide-react";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { SettingsForm } from "@/components/dashboard/sidebar/settings-form";

import { formatCurrency } from "@/lib/number";

import { useSignout } from "@/hooks/client/use-signout";

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
  const [dialogOpen, setDialogOpen] = useState(false);

  const { isMobile } = useSidebar();

  const { handleSignOut, isLoading } = useSignout();

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-2"
          >
            <Avatar className="size-10">
              <AvatarImage
                src={profile.avatar_url || undefined}
                alt={profile.username.toLowerCase()}
              />
              <AvatarFallback>
                {profile.username
                  .split(" ")
                  .map((n) => n[0]?.toUpperCase())
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text truncate font-semibold">{profile.username}</p>
              <span className="text-muted-foreground truncate text-xs">
                {formatCurrency(netWorth, profile.display_currency)}
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
          <DropdownMenuItem disabled>{email}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault(); // This keeps the dropdown open
              handleSignOut("local");
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {isLoading ? "Signing out..." : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Change here your profile information
          </DialogDescription>
        </DialogHeader>
        <SettingsForm
          profile={profile}
          email={email}
          onSuccess={() => setDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
