import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

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
      <Sidebar />
      <SidebarInset>
        <Header />
        <div className="p-4 pt-2">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
