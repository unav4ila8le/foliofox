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

import {
  SettingsDialog,
  type SettingsDialogTab,
} from "@/components/features/settings/dialog";
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

const SETTINGS_QUERY_PARAM = "settings";
const DEFAULT_SETTINGS_TAB: SettingsDialogTab = "account";

function parseSettingsTabFromQuery(
  rawValue: string | null,
): SettingsDialogTab | null {
  if (rawValue === "account" || rawValue === "emails") {
    return rawValue;
  }

  return null;
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
  // Tracks whether the user has explicitly closed the dialog after a deep
  // link opened it. Needed because `router.replace` clears the URL param
  // asynchronously; without this, the next render would re-open the dialog.
  const [isDeepLinkDismissed, setIsDeepLinkDismissed] = useState(false);
  const [financialProfileDialogOpen, setFinancialProfileDialogOpen] =
    useState(false);

  const requestedTabFromQuery = parseSettingsTabFromQuery(
    searchParams.get(SETTINGS_QUERY_PARAM),
  );
  const isOpenedByDeepLink =
    requestedTabFromQuery !== null && !isDeepLinkDismissed;
  const settingsDialogOpen = isSettingsDialogOpen || isOpenedByDeepLink;
  const requestedSettingsTab = requestedTabFromQuery ?? DEFAULT_SETTINGS_TAB;

  function handleSettingsDialogChange(open: boolean) {
    setIsSettingsDialogOpen(open);
    setIsDeepLinkDismissed(!open && requestedTabFromQuery !== null);

    if (open || requestedTabFromQuery === null) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete(SETTINGS_QUERY_PARAM);

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
              setIsDeepLinkDismissed(false);
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
        requestedTab={requestedSettingsTab}
      />
    </>
  );
}
