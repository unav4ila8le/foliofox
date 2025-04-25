import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  // Sidebar state
  const sidebarStateCookie = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarStateCookie !== "false";

  // Supabase client
  const supabase = await createClient();

  // Get user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If user is not logged in, redirect to login page
  if (error || !user || !user.email) {
    redirect("/auth/login");
  }

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_currency, avatar_url")
    .eq("id", user.id)
    .single();

  // Handle the edge case where profile might not exist
  if (!profile) {
    throw new Error("Profile not found");
  }

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
      <DashboardSidebar profile={profile} email={user.email} />
      <SidebarInset>
        <Header />
        <div className="p-4 pt-2">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
