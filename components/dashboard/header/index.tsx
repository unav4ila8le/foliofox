import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Breadcrumb } from "./breadcrumb";
import { NewActionButton } from "./new-action-button";
import { FeedbackButton } from "@/components/dashboard/header/feedback";
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

        {/* Desktop breadcrumb */}
        <div className="hidden md:block">
          <Breadcrumb />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NewActionButton />
        <FeedbackButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
