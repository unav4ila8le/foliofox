import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Header() {
  return (
    <div className="flex items-center justify-between pt-2 pr-4 pb-0 pl-2">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Button>
          <Plus />
          New Transaction
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
