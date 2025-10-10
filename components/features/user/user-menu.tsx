"use client";

import { useState, type ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

import { SettingsForm } from "@/components/dashboard/layout/left-sidebar/settings-form";
import { signOut } from "@/server/auth/sign-out";

import type { Profile } from "@/types/global.types";

interface UserMenuProps {
  profile: Profile;
  email?: string;
  children: ReactNode;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
  menuSideOffset?: number;
}

export function UserMenu({
  profile,
  email,
  children,
  menuSide = "bottom",
  menuAlign = "end",
  menuSideOffset = 4,
}: UserMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    const result = await signOut("local");
    if (!result.success) {
      toast.error("Logout failed", { description: result.message });
      setIsLoading(false);
      return;
    }
    toast.success("You have been logged out successfully");
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[var(--radix-dropdown-menu-trigger-width)] md:w-auto md:min-w-56"
          side={menuSide}
          align={menuAlign}
          sideOffset={menuSideOffset}
        >
          {email ? <DropdownMenuItem disabled>{email}</DropdownMenuItem> : null}
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              handleSignOut();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="size-4" />
                Log out
              </>
            )}
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
          email={email ?? ""}
          onSuccess={() => setDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
