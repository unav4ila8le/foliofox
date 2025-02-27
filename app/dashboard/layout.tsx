import { cookies } from "next/headers";

import { SidebarProvider } from "@/components/ui/sidebar";
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
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar />
      <main className="flex w-full flex-col">
        <Header />
        <div className="flex-1 p-4">{children}</div>
      </main>
    </SidebarProvider>
  );
}
