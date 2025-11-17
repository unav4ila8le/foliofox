"use client";

import { useState, type ReactNode } from "react";
import { CircleUser, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

import { SettingsDialog } from "@/components/dashboard/layout/left-sidebar/settings/dialog";
import { FinancialProfileDialog } from "@/components/features/financial-profile/dialog";
import { signOut } from "@/server/auth/sign-out";

import type { FinancialProfile, Profile } from "@/types/global.types";

interface UserMenuProps {
  profile: Profile;
  email: string;
  financialProfile?: FinancialProfile | null;
  children: ReactNode;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
  menuSideOffset?: number;
}

export function UserMenu({
  profile,
  email,
  financialProfile,
  children,
  menuSide = "bottom",
  menuAlign = "end",
  menuSideOffset = 4,
}: UserMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [financialProfileDialogOpen, setFinancialProfileDialogOpen] =
    useState(false);

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="min-w-(--radix-dropdown-menu-trigger-width) md:w-auto md:min-w-56"
          side={menuSide}
          align={menuAlign}
          sideOffset={menuSideOffset}
        >
          <DropdownMenuItem disabled>{email}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setFinancialProfileDialogOpen(true);
            }}
          >
            <CircleUser className="size-4" />
            Financial profile
            <Badge className="bg-brand ml-auto">New</Badge>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setSettingsDialogOpen(true);
            }}
          >
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
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
      <FinancialProfileDialog
        open={financialProfileDialogOpen}
        onOpenChange={setFinancialProfileDialogOpen}
        profile={profile}
        financialProfile={financialProfile}
      />
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        profile={profile}
        email={email}
      />
    </>
  );
}
