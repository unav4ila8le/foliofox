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

import { SettingsDialog } from "@/components/features/settings/dialog";
import { FinancialProfileDialog } from "@/components/features/financial-profile/dialog";
import { signOut } from "@/server/auth/sign-out";
import { useOptionalDashboardData } from "@/components/dashboard/dashboard-data-provider";

import type { FinancialProfile, Profile } from "@/types/global.types";

interface UserMenuProps {
  children: ReactNode;
  profile?: Profile;
  financialProfile?: FinancialProfile | null;
  email?: string;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
  menuSideOffset?: number;
}

export function UserMenu({
  children,
  profile: profileProp,
  financialProfile: financialProfileProp = null,
  email,
  menuSide = "bottom",
  menuAlign = "end",
  menuSideOffset = 4,
}: UserMenuProps) {
  const dashboardData = useOptionalDashboardData();
  const profile = dashboardData?.profile ?? profileProp;
  const financialProfile =
    dashboardData?.financialProfile ?? financialProfileProp;
  const emailValue = dashboardData?.email ?? email;

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
          {emailValue && (
            <>
              <DropdownMenuItem disabled>{emailValue}</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setFinancialProfileDialogOpen(true);
            }}
          >
            <CircleUser className="size-4" />
            Financial profile
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
        email={emailValue}
      />
    </>
  );
}
