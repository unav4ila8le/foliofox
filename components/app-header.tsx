import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <div className="flex items-center justify-between pt-2 pr-4 pb-0 pl-2">
      <SidebarTrigger />
      <ThemeToggle />
    </div>
  );
}
