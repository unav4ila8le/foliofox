"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { VariantProps, cva } from "class-variance-authority";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/custom/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_LEFT_COOKIE_NAME = "sidebar_left_state";
const SIDEBAR_RIGHT_COOKIE_NAME = "sidebar_right_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_LEFT_KEYBOARD_SHORTCUT = "b";
const SIDEBAR_RIGHT_KEYBOARD_SHORTCUT = "i";

type SidebarContext = {
  // Back-compat (maps to left)
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;

  // Side-aware API
  stateLeft: "expanded" | "collapsed";
  stateRight: "expanded" | "collapsed";

  openLeft: boolean;
  setOpenLeft: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobileLeft: boolean;
  setOpenMobileLeft: (open: boolean) => void;
  toggleLeft: () => void;

  openRight: boolean;
  setOpenRight: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobileRight: boolean;
  setOpenMobileRight: (open: boolean) => void;
  toggleRight: () => void;

  isMobile: boolean;

  // Resizing
  resizable: { left: boolean; right: boolean };
  leftWidth: string;
  rightWidth: string;
  setLeftWidth: (width: string) => void;
  setRightWidth: (width: string) => void;
  minLeftWidth: string;
  minRightWidth: string;
  maxLeftWidth: string;
  maxRightWidth: string;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

// Internal: which side we're rendering in this subtree.
const SidebarSectionContext = React.createContext<"left" | "right" | null>(
  null,
);

// Instance-level context: conveys per-Sidebar instance state like sheet mode
const SidebarInstanceContext = React.createContext<{
  isSheetMobile: boolean;
} | null>(null);

function useSidebarInstance(): { isSheetMobile: boolean } {
  return React.useContext(SidebarInstanceContext) ?? { isSheetMobile: false };
}

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

function useSidebarSection(): "left" | "right" {
  return React.useContext(SidebarSectionContext) ?? "left";
}

function SidebarProvider({
  // Back-compat: defaultOpen maps to left
  defaultOpen = true,
  // New: default right state
  defaultOpenRight = true,

  // Controlled left (back-compat names)
  open: openLeftProp,
  onOpenChange: setOpenLeftProp,

  // Controlled right
  openRight: openRightProp,
  onOpenRightChange: setOpenRightProp,

  // Resizable config
  resizable,
  // Widths (CSS lengths; e.g., "16rem", "24rem")
  defaultLeftWidth = SIDEBAR_WIDTH,
  defaultRightWidth = SIDEBAR_WIDTH,
  minLeftWidth = "14rem",
  maxLeftWidth = "28rem",
  minRightWidth = "14rem",
  maxRightWidth = "28rem",

  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  defaultOpenRight?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  openRight?: boolean;
  onOpenRightChange?: (open: boolean) => void;
  resizable?: Partial<Record<"left" | "right", boolean>>;
  defaultLeftWidth?: string;
  defaultRightWidth?: string;
  minLeftWidth?: string;
  maxLeftWidth?: string;
  minRightWidth?: string;
  maxRightWidth?: string;
}) {
  const isMobile = useIsMobile();

  // Mobile open states (per side)
  const [openMobileLeft, setOpenMobileLeft] = React.useState(false);
  const [openMobileRight, setOpenMobileRight] = React.useState(false);

  // Widths (desktop)
  const [leftWidth, setLeftWidth] = React.useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = React.useState(defaultRightWidth);

  // Desktop open states (per side)
  const [_openLeft, _setOpenLeft] = React.useState(defaultOpen);
  const openLeft = openLeftProp ?? _openLeft;
  const setOpenLeft = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next =
        typeof value === "function"
          ? (value as (v: boolean) => boolean)(openLeft)
          : value;
      if (setOpenLeftProp) setOpenLeftProp(next);
      else _setOpenLeft(next);

      document.cookie = `${SIDEBAR_LEFT_COOKIE_NAME}=${String(next)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [openLeft, setOpenLeftProp],
  );

  const [_openRight, _setOpenRight] = React.useState(defaultOpenRight);
  const openRight = openRightProp ?? _openRight;
  const setOpenRight = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next =
        typeof value === "function"
          ? (value as (v: boolean) => boolean)(openRight)
          : value;
      if (setOpenRightProp) setOpenRightProp(next);
      else _setOpenRight(next);

      document.cookie = `${SIDEBAR_RIGHT_COOKIE_NAME}=${String(next)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [openRight, setOpenRightProp],
  );

  const resizableNormalized = React.useMemo(
    () => ({
      left: Boolean(resizable?.left),
      right: Boolean(resizable?.right),
    }),
    [resizable?.left, resizable?.right],
  );

  // Toggles per side
  const toggleLeft = React.useCallback(() => {
    return isMobile ? setOpenMobileLeft((v) => !v) : setOpenLeft((v) => !v);
  }, [isMobile, setOpenLeft, setOpenMobileLeft]);

  const toggleRight = React.useCallback(() => {
    return isMobile ? setOpenMobileRight((v) => !v) : setOpenRight((v) => !v);
  }, [isMobile, setOpenRight, setOpenMobileRight]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key === SIDEBAR_LEFT_KEYBOARD_SHORTCUT) {
        event.preventDefault();
        toggleLeft();
      } else if (event.key === SIDEBAR_RIGHT_KEYBOARD_SHORTCUT) {
        event.preventDefault();
        toggleRight();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeft, toggleRight]);

  // States for styling
  const stateLeft = openLeft ? "expanded" : "collapsed";
  const stateRight = openRight ? "expanded" : "collapsed";

  // Back-compat aliases map to left
  const state = stateLeft;
  const open = openLeft;
  const setOpen = setOpenLeft;
  const openMobile = openMobileLeft;
  const setOpenMobile = setOpenMobileLeft;
  const toggleSidebar = toggleLeft;

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      // back-compat
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      toggleSidebar,

      // side-aware
      stateLeft,
      stateRight,

      openLeft,
      setOpenLeft,
      openMobileLeft,
      setOpenMobileLeft,
      toggleLeft,

      openRight,
      setOpenRight,
      openMobileRight,
      setOpenMobileRight,
      toggleRight,

      isMobile,

      // resizing
      resizable: resizableNormalized,
      leftWidth,
      rightWidth,
      setLeftWidth,
      setRightWidth,
      minLeftWidth,
      maxLeftWidth,
      minRightWidth,
      maxRightWidth,
    }),
    [
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      stateLeft,
      stateRight,
      openLeft,
      setOpenLeft,
      openMobileLeft,
      setOpenMobileLeft,
      toggleLeft,
      openRight,
      setOpenRight,
      openMobileRight,
      setOpenMobileRight,
      toggleRight,
      isMobile,
      resizableNormalized,
      leftWidth,
      rightWidth,
      minLeftWidth,
      maxLeftWidth,
      minRightWidth,
      maxRightWidth,
    ],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              // Per-side CSS variables; each Sidebar instance maps these to its local --sidebar-width vars.
              "--sidebar-left-width": leftWidth,
              "--sidebar-left-width-icon": SIDEBAR_WIDTH_ICON,
              "--sidebar-left-width-mobile": SIDEBAR_WIDTH_MOBILE,
              "--sidebar-right-width": rightWidth,
              "--sidebar-right-width-icon": SIDEBAR_WIDTH_ICON,
              "--sidebar-right-width-mobile": SIDEBAR_WIDTH_MOBILE,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  showCloseButton = false,
  mobileBreakpoint,
  className,
  children,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  showCloseButton?: boolean;
  mobileBreakpoint?: string;
}) {
  const {
    isMobile,
    openLeft,
    openRight,
    openMobileLeft,
    openMobileRight,
    setOpenMobileLeft,
    setOpenMobileRight,
    setOpenLeft,
    setOpenRight,
  } = useSidebar();

  // Check if the mobile breakpoint is set
  const isMobileCustom = useMediaQuery(
    mobileBreakpoint ?? "(max-width: 767px)",
  );
  const isSheetMobile = mobileBreakpoint ? isMobileCustom : isMobile;

  const open = side === "right" ? openRight : openLeft;
  const openMobile = side === "right" ? openMobileRight : openMobileLeft;
  const setOpenMobile =
    side === "right" ? setOpenMobileRight : setOpenMobileLeft;
  const state = open ? "expanded" : "collapsed";

  // Sync the active open state with the current render mode (sheet vs desktop)
  const setOpen = side === "right" ? setOpenRight : setOpenLeft;

  React.useEffect(() => {
    if (isSheetMobile) {
      // If we're in sheet mode but desktop state was toggled, move it to mobile state
      if (open && !openMobile) {
        setOpenMobile(true);
        setOpen(false);
      }
    } else {
      // If we're in desktop mode but mobile state was toggled, move it to desktop state
      if (openMobile && !open) {
        setOpen(true);
        setOpenMobile(false);
      }
    }
    // We intentionally depend on all to catch toggles
  }, [isSheetMobile, open, openMobile, setOpen, setOpenMobile]);

  // Map per-side width vars to the shared --sidebar-width vars for this instance
  const widthVars =
    side === "right"
      ? ({
          "--sidebar-width": "var(--sidebar-right-width)",
          "--sidebar-width-icon": "var(--sidebar-right-width-icon)",
        } as React.CSSProperties)
      : ({
          "--sidebar-width": "var(--sidebar-left-width)",
          "--sidebar-width-icon": "var(--sidebar-left-width-icon)",
        } as React.CSSProperties);

  const widthVarsMobile =
    side === "right"
      ? ({
          "--sidebar-width": "var(--sidebar-right-width-mobile)",
        } as React.CSSProperties)
      : ({
          "--sidebar-width": "var(--sidebar-left-width-mobile)",
        } as React.CSSProperties);

  if (collapsible === "none") {
    return (
      <SidebarInstanceContext.Provider value={{ isSheetMobile }}>
        <SidebarSectionContext.Provider value={side}>
          <div
            data-slot="sidebar"
            className={cn(
              "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
              className,
            )}
            style={{ ...widthVars, ...style }}
            {...props}
          >
            {children}
          </div>
        </SidebarSectionContext.Provider>
      </SidebarInstanceContext.Provider>
    );
  }

  if (isSheetMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Mobile sidebar.</SheetDescription>
        </SheetHeader>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0"
          style={widthVarsMobile}
          side={side}
          showCloseButton={showCloseButton}
        >
          <SidebarInstanceContext.Provider value={{ isSheetMobile }}>
            <SidebarSectionContext.Provider value={side}>
              <div className="flex h-full w-full flex-col">{children}</div>
            </SidebarSectionContext.Provider>
          </SidebarInstanceContext.Provider>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <SidebarInstanceContext.Provider value={{ isSheetMobile }}>
      <SidebarSectionContext.Provider value={side}>
        <div
          className="group peer text-sidebar-foreground hidden md:block"
          data-state={state}
          data-collapsible={state === "collapsed" ? collapsible : ""}
          data-variant={variant}
          data-side={side}
          data-slot="sidebar"
          style={{ ...widthVars, ...style }}
        >
          {/* This is the desktop spacer/gap */}
          <div
            className={cn(
              "relative h-svh w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[sidebar-resizing=true]/sidebar-wrapper:transition-none",
              "group-data-[collapsible=offcanvas]:w-0",
              "group-data-[side=right]:rotate-180",
              variant === "floating" || variant === "inset"
                ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
                : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
            )}
          />
          {/* Fixed panel */}
          <div
            className={cn(
              "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear group-data-[sidebar-resizing=true]/sidebar-wrapper:transition-none md:flex",
              side === "left"
                ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
              variant === "floating" || variant === "inset"
                ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
                : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
              className,
            )}
            {...props}
          >
            <div
              data-sidebar="sidebar"
              className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
            >
              {children}
            </div>
          </div>
        </div>
      </SidebarSectionContext.Provider>
    </SidebarInstanceContext.Provider>
  );
}

function SidebarTrigger({
  side = "left",
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { side?: "left" | "right" }) {
  const { toggleLeft, toggleRight } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (side === "right") {
          toggleRight();
        } else {
          toggleLeft();
        }
      }}
      {...props}
    >
      {side === "left" ? <PanelLeftIcon /> : <PanelRightIcon />}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function SidebarRail({
  side = "left",
  className,
  ...props
}: React.ComponentProps<"button"> & { side?: "left" | "right" }) {
  const {
    isMobile,
    toggleLeft,
    toggleRight,
    resizable,
    setLeftWidth,
    setRightWidth,
    minLeftWidth,
    maxLeftWidth,
    minRightWidth,
    maxRightWidth,
  } = useSidebar();
  const { isSheetMobile } = useSidebarInstance();

  const dragging = React.useRef(false);

  // Cleanup in case the component unmounts or hot-reloads during a drag.
  React.useEffect(() => {
    return () => {
      const wrapper = document.querySelector<HTMLElement>(
        '[data-slot="sidebar-wrapper"]',
      );
      if (wrapper?.dataset.sidebarResizing) {
        delete wrapper.dataset.sidebarResizing;
      }
      dragging.current = false;
    };
  }, []);

  const onMouseDown = () => {
    if (isMobile || isSheetMobile || !resizable[side]) return;

    dragging.current = true;

    // Cache the wrapper element once for the drag session.
    const wrapper = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-wrapper"]',
    );
    if (!wrapper) return;

    // Mark resizing on the wrapper so children can disable transitions.
    wrapper.dataset.sidebarResizing = "true";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const x = ev.clientX;
      const vw = window.innerWidth;
      const px = side === "left" ? Math.max(0, x) : Math.max(0, vw - x);
      const min = side === "left" ? minLeftWidth : minRightWidth;
      const max = side === "left" ? maxLeftWidth : maxRightWidth;
      const next = `clamp(${min}, ${Math.round(px)}px, ${max})`;
      // Hot path: write directly to CSS var to avoid React re-renders while dragging.
      const varName =
        side === "left" ? "--sidebar-left-width" : "--sidebar-right-width";
      wrapper.style.setProperty(varName, next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Commit final width to React state (single render), then clear the resizing flag.
      const varName =
        side === "left" ? "--sidebar-left-width" : "--sidebar-right-width";
      const finalValue = wrapper.style.getPropertyValue(varName).trim();
      if (finalValue) {
        if (side === "left") setLeftWidth(finalValue);
        else setRightWidth(finalValue);
      }
      delete wrapper.dataset.sidebarResizing;
      setTimeout(() => (dragging.current = false), 0);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onClick = () => {
    if (dragging.current) return;
    if (side === "right") {
      toggleRight();
    } else {
      toggleLeft();
    }
  };

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Resize Sidebar"
      tabIndex={-1}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title="Resize Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-col-resize in-data-[side=right]:cursor-col-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-col-resize [[data-side=right][data-state=collapsed]_&]:cursor-col-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex h-svh min-h-0 flex-1 flex-col overflow-auto",
        "peer-data-[variant=inset]:min-h-[calc(100svh-(--spacing(4)))] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("bg-background h-8 w-full shadow-none", className)}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button";
  const { isMobile, stateLeft, stateRight } = useSidebar();
  const sectionSide = useSidebarSection();
  const collapsedState = sectionSide === "right" ? stateRight : stateLeft;

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={collapsedState !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

// Random width between 50 to 90%
function getRandomSkeletonWidth() {
  return `${Math.floor(Math.random() * 40) + 50}%`;
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean;
}) {
  const width = getRandomSkeletonWidth();

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
