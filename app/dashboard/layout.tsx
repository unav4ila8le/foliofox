import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/layout/sidebar";
import { Header } from "@/components/dashboard/layout/header";
import {
  RightPanelProvider,
  RightPanel,
} from "@/components/dashboard/layout/right-panel";
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
  const sidebarStateCookie = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarStateCookie !== "false";

  // Right panel state
  const aiPanelCookie = cookieStore.get("ai_panel_state")?.value;
  const aiDefaultOpen = aiPanelCookie !== "false";

  const { profile, email } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "max(16rem, 16vw)",
          "--sidebar-width-mobile": "max(18rem, 80vw)",
        } as React.CSSProperties
      }
    >
      <RightPanelProvider defaultOpen={aiDefaultOpen}>
        <ImportHoldingsDialogProvider>
          <NewHoldingDialogProvider profile={profile}>
            <NewRecordDialogProvider>
              <DashboardSidebar
                profile={profile}
                email={email}
                netWorth={netWorth}
              />
              <SidebarInset className="min-w-0">
                <Header />
                <div className="p-4 pt-2">{children}</div>
              </SidebarInset>
              <RightPanel />
            </NewRecordDialogProvider>
          </NewHoldingDialogProvider>
        </ImportHoldingsDialogProvider>
      </RightPanelProvider>
    </SidebarProvider>
  );
}
