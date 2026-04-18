"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

import { signOut } from "@/server/auth/sign-out";

interface UserMenuProps {
  children: ReactNode;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
  menuSideOffset?: number;
}

export function UserMenu({
  children,
  menuSide = "bottom",
  menuAlign = "end",
  menuSideOffset = 4,
}: UserMenuProps) {
  const { email: emailValue } = useDashboardData();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isSettingsDialogDismissed, setIsSettingsDialogDismissed] =
    useState(false);
  const [financialProfileDialogOpen, setFinancialProfileDialogOpen] =
    useState(false);
  const settingsQueryValue = searchParams.get("settings");
  const settingsRequestedFromQuery =
    settingsQueryValue === "profile" || settingsQueryValue === "emails";
  const settingsDialogOpen =
    isSettingsDialogOpen ||
    (settingsRequestedFromQuery && !isSettingsDialogDismissed);

  function handleSettingsDialogChange(open: boolean) {
    setIsSettingsDialogOpen(open);
    setIsSettingsDialogDismissed(!open && settingsRequestedFromQuery);

    if (open || !settingsQueryValue) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("settings");

    const nextUrl = nextSearchParams.size
      ? `${pathname}?${nextSearchParams.toString()}`
      : pathname;

    router.replace(nextUrl, {
      scroll: false,
    });
  }

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
              setIsSettingsDialogDismissed(false);
              handleSettingsDialogChange(true);
            }}
          >
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
          <ThemeToggle />
          <DropdownMenuSeparator />
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
      />
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={handleSettingsDialogChange}
      />
    </>
  );
}
