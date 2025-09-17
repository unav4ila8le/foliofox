import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LeftSidebar } from "@/components/dashboard/layout/left-sidebar";
import { RightSidebar } from "@/components/dashboard/layout/right-sidebar";
import { Header } from "@/components/dashboard/layout/header";

import { ImportHoldingsDialogProvider } from "@/components/dashboard/holdings/import";
import { NewHoldingDialogProvider } from "@/components/dashboard/new-holding";
import { NewRecordDialogProvider } from "@/components/dashboard/new-record";

import { fetchProfile } from "@/server/profile/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  // Left sidebar state
  const leftSidebarCookie =
    cookieStore.get("sidebar_left_state")?.value ?? "true";
  const defaultOpenLeft = leftSidebarCookie !== "false";

  // Right sidebar state
  const rightSidebarCookie =
    cookieStore.get("sidebar_right_state")?.value ?? "true";
  const defaultOpenRight = rightSidebarCookie !== "false";

  const { profile, email } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);

  return (
    <SidebarProvider
      defaultOpen={defaultOpenLeft}
      defaultOpenRight={defaultOpenRight}
      resizable={{ right: true }}
      defaultLeftWidth="max(16rem, 14vw)"
      defaultRightWidth="max(16rem, 20vw)"
      minRightWidth="14rem"
      maxRightWidth="28rem"
      style={
        {
          "--sidebar-left-width-mobile": "max(18rem, 80vw)",
          "--sidebar-right-width-mobile": "max(18rem, 80vw)",
        } as React.CSSProperties
      }
    >
      <ImportHoldingsDialogProvider>
        <NewHoldingDialogProvider profile={profile}>
          <NewRecordDialogProvider>
            {/* Left sidebar */}
            <LeftSidebar profile={profile} email={email} netWorth={netWorth} />

            {/* Main content */}
            <SidebarInset className="min-w-0">
              <Header />
              <div className="p-4 pt-2">{children}</div>
            </SidebarInset>

            {/* Right sidebar */}
            <RightSidebar />
          </NewRecordDialogProvider>
        </NewHoldingDialogProvider>
      </ImportHoldingsDialogProvider>
    </SidebarProvider>
  );
}
