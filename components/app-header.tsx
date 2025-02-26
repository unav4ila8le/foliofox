import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <div className="flex items-center justify-between p-2">
      <SidebarTrigger />
      <ThemeToggle />
    </div>
  );
}
