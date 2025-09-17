import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Breadcrumb } from "./breadcrumb";
import { NewActionButton } from "./new-action-button";
import { FeedbackButton } from "@/components/dashboard/layout/header/feedback";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <SidebarTrigger className="-ml-2 xl:hidden" />
          </TooltipTrigger>
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>

        {/* Desktop breadcrumb */}
        <div className="hidden md:block">
          <Breadcrumb />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NewActionButton />
        <FeedbackButton />
        <ThemeToggle />
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <SidebarTrigger side="right" />
          </TooltipTrigger>
          <TooltipContent>Toggle AI Chat</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
