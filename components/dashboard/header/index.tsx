import { ThemeToggle } from "@/components/theme-toggle";
import { NewRecordButton } from "@/components/dashboard/header/new-record";
import { NewHoldingButton } from "@/components/dashboard/new-holding";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="hidden md:block">breadcrumb goes here</div>
      </div>
      <div className="flex items-center gap-2">
        <NewHoldingButton />
        <NewRecordButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
