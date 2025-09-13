"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PanelRight } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { Chat } from "./chat";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const AI_PANEL_COOKIE_NAME = "ai_panel_state";
const AI_PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

type RightPanelContext = {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggle: () => void;
};

const RightPanelContext = createContext<RightPanelContext | null>(null);

export function useRightPanel(): RightPanelContext {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    throw new Error("useRightPanel must be used within RightPanelProvider.");
  }
  return ctx;
}

interface RightPanelProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function RightPanelProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
}: RightPanelProviderProps): ReactNode {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)"); // lg breakpoint

  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;

  const [openMobile, setOpenMobile] = useState(false);

  const setOpen = useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next =
        typeof value === "function"
          ? (value as (v: boolean) => boolean)(open)
          : value;

      if (onOpenChange) onOpenChange(next);
      else _setOpen(next);

      // Persist desktop state (match shadcn)
      document.cookie = `${AI_PANEL_COOKIE_NAME}=${String(next)}; path=/; max-age=${AI_PANEL_COOKIE_MAX_AGE}`;
    },
    [open, onOpenChange],
  );

  const toggle = useCallback(() => {
    // Match shadcn: on smaller screens, use a Sheet (no cookie write required)
    return !isLargeScreen ? setOpenMobile((v) => !v) : setOpen((v) => !v);
  }, [isLargeScreen, setOpen]);

  const contextValue = useMemo(
    () => ({ open, setOpen, openMobile, setOpenMobile, toggle }),
    [open, setOpen, openMobile, setOpenMobile, toggle],
  );

  return (
    <RightPanelContext.Provider value={contextValue}>
      {children}
    </RightPanelContext.Provider>
  );
}

export function RightPanel({
  username,
}: {
  username: string;
}): React.ReactNode | null {
  const { open, openMobile, setOpenMobile } = useRightPanel();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // Mobile: use Sheet
  if (!isLargeScreen) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="right"
          className="bg-sidebar text-sidebar-foreground w-[80vw] p-4"
        >
          <SheetHeader>
            <SheetTitle>Foliofox AI</SheetTitle>
            <SheetDescription>Chat interface coming soon...</SheetDescription>
          </SheetHeader>
          <Chat username={username} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed panel with transitions
  return (
    <div
      className="group peer text-sidebar-foreground hidden lg:block"
      data-state={open ? "expanded" : "collapsed"}
      data-side="right"
    >
      {/* Spacer for layout */}
      <div
        className={cn(
          "relative h-svh bg-transparent transition-[width] duration-200 ease-linear",
          "w-[max(16rem,20vw)]",
          "group-data-[state=collapsed]:w-0",
        )}
      />
      {/* Fixed panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh transition-[right] duration-200 ease-linear md:flex",
          "w-[max(16rem,20vw)]",
          "group-data-[state=collapsed]:right-[calc(max(16rem,20vw)*-1)]",
        )}
      >
        <div className="bg-sidebar flex h-full w-full flex-col p-4 ps-2">
          <Chat username={username} />
        </div>
      </div>
    </div>
  );
}

export function RightPanelToggleButton() {
  const { toggle } = useRightPanel();

  return (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={toggle}>
            <PanelRight className="size-4" />
            <span className="sr-only">Toggle AI Advisor</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle AI Advisor</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
