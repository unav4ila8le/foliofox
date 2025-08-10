import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
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

  // Sidebar state
  const sidebarStateCookie = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarStateCookie !== "false";

  const { profile, email } = await fetchProfile();
  const netWorth = await calculateNetWorth(profile.display_currency);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "max(16rem, 20vw)",
          "--sidebar-width-mobile": "max(18rem, 80vw)",
        } as React.CSSProperties
      }
    >
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
          </NewRecordDialogProvider>
        </NewHoldingDialogProvider>
      </ImportHoldingsDialogProvider>
    </SidebarProvider>
  );
}
