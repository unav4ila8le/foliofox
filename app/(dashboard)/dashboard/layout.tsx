import { cookies } from "next/headers";
import { cacheLife } from "next/cache";

import { SidebarInset, SidebarProvider } from "@/components/ui/custom/sidebar";
import { LeftSidebar } from "@/components/dashboard/layout/left-sidebar";
import { RightSidebar } from "@/components/dashboard/layout/right-sidebar";
import { Header } from "@/components/dashboard/layout/header";

import { PrivacyModeProvider } from "@/components/dashboard/privacy-mode-provider";
import { NetWorthModeProvider } from "@/components/dashboard/net-worth-mode/net-worth-mode-provider";
import { ImportPositionsDialogProvider } from "@/components/dashboard/positions/import";
import { ImportPortfolioRecordsDialogProvider } from "@/components/dashboard/portfolio-records/import";
import { NewAssetDialogProvider } from "@/components/dashboard/new-asset";
import { NewPortfolioRecordDialogProvider } from "@/components/dashboard/new-portfolio-record";
import { DashboardDataProvider } from "@/components/dashboard/dashboard-data-provider";

import { fetchProfile } from "@/server/profile/actions";
import { fetchFinancialProfile } from "@/server/financial-profiles/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { fetchStalePositions } from "@/server/positions/stale";
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

  const { profile, email } = await fetchProfile();
  const [financialProfile, netWorth, stalePositions] = await Promise.all([
    fetchFinancialProfile(),
    calculateNetWorth(profile.display_currency),
    fetchStalePositions(),
  ]);

  return (
    <DashboardDataProvider
      value={{
        profile,
        email,
        financialProfile,
        netWorth,
        stalePositions,
      }}
    >
      <SidebarProvider
        defaultOpen={defaultOpenLeft}
        defaultOpenRight={defaultOpenRight}
        resizable={{ right: true }}
        defaultLeftWidth="max(16rem, 12vw)"
        defaultRightWidth="max(16rem, 20vw)"
        minRightWidth="16rem"
        maxRightWidth="24vw"
      >
        <NetWorthModeProvider defaultMode={netWorthMode}>
          <PrivacyModeProvider>
            <ImportPositionsDialogProvider>
              <ImportPortfolioRecordsDialogProvider>
                <NewAssetDialogProvider>
                  <NewPortfolioRecordDialogProvider>
                    {/* Left sidebar */}
                    <LeftSidebar />

                    {/* Main content */}
                    <SidebarInset className="min-w-0">
                      <Header />
                      <div className="mx-auto w-full max-w-7xl p-4 pt-2">
                        {children}
                      </div>
                    </SidebarInset>

                    {/* Right sidebar */}
                    <RightSidebar />
                  </NewPortfolioRecordDialogProvider>
                </NewAssetDialogProvider>
              </ImportPortfolioRecordsDialogProvider>
            </ImportPositionsDialogProvider>
          </PrivacyModeProvider>
        </NetWorthModeProvider>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}
