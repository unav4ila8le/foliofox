import { Suspense } from "react";

import { Loader2 } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/custom/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { fetchCurrentPublicPortfolio } from "@/server/public-portfolios/fetch";
import { AIChatToggle } from "./ai-chat-toggle";
import { Breadcrumb } from "./breadcrumb";
import { NewActionButton } from "./new-action-button";
import { FeedbackButton } from "@/components/dashboard/layout/header/feedback";
import { SharePortfolioButton } from "@/components/dashboard/share-portfolio";

async function SharePortfolioButtonWrapper() {
  const shareMetadata = await fetchCurrentPublicPortfolio();
  return <SharePortfolioButton initialShareMetadata={shareMetadata} />;
}

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <SidebarTrigger className="-ml-2" />
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
        <Suspense
          fallback={
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Share
            </Button>
          }
        >
          <SharePortfolioButtonWrapper />
        </Suspense>
        <FeedbackButton />
        <div className="hidden md:block">
          <AIChatToggle />
        </div>
      </div>
    </header>
  );
}
