import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewRecordButton } from "@/components/dashboard/new-record";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 lg:justify-end">
      <TooltipProvider>
        <Tooltip delayDuration={700}>
          <TooltipTrigger asChild>
            <SidebarTrigger className="-ml-2 lg:hidden" />
          </TooltipTrigger>
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="flex items-center gap-2">
        <NewRecordButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
