import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { NewHoldingDialogProvider } from "@/components/dashboard/new-holding";
import { NewRecordDialogProvider } from "@/components/dashboard/new-record";

import { fetchProfile } from "@/server/profile/actions";

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
      <NewHoldingDialogProvider profile={profile}>
        <NewRecordDialogProvider>
          <DashboardSidebar profile={profile} email={email} />
          <SidebarInset>
            <Header />
            <div className="p-4 pt-2">{children}</div>
          </SidebarInset>
        </NewRecordDialogProvider>
      </NewHoldingDialogProvider>
    </SidebarProvider>
  );
}
