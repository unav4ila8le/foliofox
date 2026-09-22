import { cookies } from "next/headers";
import { cacheLife } from "next/cache";

import { SidebarInset, SidebarProvider } from "@/components/ui/custom/sidebar";
import { AIChatProvider } from "@/components/dashboard/ai-chat/provider";
import { LeftSidebar } from "@/components/dashboard/layout/left-sidebar";
import { RightSidebar } from "@/components/dashboard/layout/right-sidebar";
import { Header } from "@/components/dashboard/layout/header";
import { DashboardActivityTracker } from "@/components/dashboard/layout/activity-tracker";
import { TimeZoneAutoSync } from "@/components/dashboard/layout/time-zone-sync";

import { DashboardDataProvider } from "@/components/dashboard/providers/dashboard-data-provider";
import { DashboardDialogsProvider } from "@/components/dashboard/providers/dashboard-dialogs-provider";
import { PrivacyModeProvider } from "@/components/dashboard/providers/privacy-mode-provider";
import { NetWorthModeProvider } from "@/components/dashboard/net-worth-mode/net-worth-mode-provider";

import { fetchDashboardData } from "@/server/dashboard/fetch-dashboard-data";
import { TIME_ZONE_MODES } from "@/lib/date/time-zone";
import {
  NET_WORTH_MODE_COOKIE_NAME,
  parseNetWorthMode,
} from "@/server/analysis/net-worth/types";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  "use cache: private";
  cacheLife("hours");

  const cookieStore = await cookies();

  // Left sidebar state
  const leftSidebarCookie =
    cookieStore.get("sidebar_left_state")?.value ?? "true";
  const defaultOpenLeft = leftSidebarCookie !== "false";

  // Right sidebar state
  const rightSidebarCookie =
    cookieStore.get("sidebar_right_state")?.value ?? "true";
  const defaultOpenRight = rightSidebarCookie !== "false";
  const netWorthMode = parseNetWorthMode(
    cookieStore.get(NET_WORTH_MODE_COOKIE_NAME)?.value,
  );

  const dashboardData = await fetchDashboardData();
  const { profile } = dashboardData;

  return (
    <DashboardDataProvider value={dashboardData}>
      <SidebarProvider
        defaultOpen={defaultOpenLeft}
        defaultOpenRight={defaultOpenRight}
        resizable={{ right: true }}
        defaultLeftWidth="max(16rem, 12vw)"
        defaultRightWidth="clamp(20rem, 20vw, 24vw)"
        minRightWidth="20rem"
        maxRightWidth="24vw"
      >
        <AIChatProvider>
          <NetWorthModeProvider defaultMode={netWorthMode}>
            <PrivacyModeProvider>
              <DashboardDialogsProvider>
                {/* Left sidebar */}
                <LeftSidebar />

                {/* Main content */}
                <SidebarInset className="min-w-0">
                  <Header />
                  <div className="@container/dashboard mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 pt-2">
                    <DashboardActivityTracker
                      userId={profile.user_id}
                      lastAppActivityAt={profile.last_app_activity_at}
                    />
                    {profile.time_zone_mode === TIME_ZONE_MODES.AUTO && (
                      <TimeZoneAutoSync currentTimeZone={profile.time_zone} />
                    )}
                    {children}
                  </div>
                </SidebarInset>

                {/* Right sidebar */}
                <RightSidebar />
              </DashboardDialogsProvider>
            </PrivacyModeProvider>
          </NetWorthModeProvider>
        </AIChatProvider>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}
