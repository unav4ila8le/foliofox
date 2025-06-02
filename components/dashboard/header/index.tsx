import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Breadcrumb } from "@/components/dashboard/header/breadcrumb";
import { NewRecordButton } from "@/components/dashboard/new-record";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip delayDuration={700}>
            <TooltipTrigger asChild>
              <SidebarTrigger className="-ml-2 lg:hidden" />
            </TooltipTrigger>
            <TooltipContent>Toggle sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Breadcrumb />
      </div>
      <div className="flex items-center gap-2">
        <NewRecordButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
