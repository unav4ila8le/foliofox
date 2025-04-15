import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  // Check if user is logged in
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  // Sidebar state
  const sidebarStateCookie = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarStateCookie !== "false";

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
