"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { type CSSProperties, useEffect, useRef } from "react";

import { Skeleton } from "@/components/ui/custom/skeleton";

import { AI_CHAT_ROUTE } from "@/components/dashboard/ai-chat/navigation";
import {
  Sidebar,
  SidebarRail,
  useSidebar,
} from "@/components/ui/custom/sidebar";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

const AIChatPanel = dynamic(
  () =>
    import("@/components/dashboard/ai-chat/panel").then((module) => ({
      default: module.AIChatPanel,
    })),
  {
    loading: () => <RightSidebarChatSkeleton />,
  },
);

function RightSidebarChatSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-4">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-3/4" />
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export function RightSidebar() {
  const pathname = usePathname();
  const { profile } = useDashboardData();
  const { openRight, openMobileRight, setOpenRight, setOpenMobileRight } =
    useSidebar();
  const previousOpenRightRef = useRef<boolean | null>(null);
  const previousOpenMobileRightRef = useRef<boolean | null>(null);
  const isLockActiveRef = useRef(false);

  const isAIChatRoute = pathname === AI_CHAT_ROUTE;
  const shouldRenderSidebarChat = openRight || openMobileRight;

  useEffect(() => {
    if (isAIChatRoute) {
      if (!isLockActiveRef.current) {
        previousOpenRightRef.current = openRight;
        previousOpenMobileRightRef.current = openMobileRight;
        isLockActiveRef.current = true;
      }

      if (openRight) {
        setOpenRight(false);
      }

      if (openMobileRight) {
        setOpenMobileRight(false);
      }

      return;
    }

    if (!isLockActiveRef.current) {
      return;
    }

    if (previousOpenRightRef.current != null) {
      setOpenRight(previousOpenRightRef.current);
    }

    if (previousOpenMobileRightRef.current != null) {
      setOpenMobileRight(previousOpenMobileRightRef.current);
    }

    previousOpenRightRef.current = null;
    previousOpenMobileRightRef.current = null;
    isLockActiveRef.current = false;
  }, [
    isAIChatRoute,
    openRight,
    openMobileRight,
    setOpenRight,
    setOpenMobileRight,
  ]);

  useEffect(() => {
    if (!isAIChatRoute) {
      return;
    }

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      const hasMod = event.metaKey || event.ctrlKey;
      if (!hasMod || event.key.toLowerCase() !== "i") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDownCapture, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDownCapture, true);
    };
  }, [isAIChatRoute]);

  if (isAIChatRoute) {
    return null;
  }

  return (
    <Sidebar
      side="right"
      showCloseButton
      mobileBreakpoint="(max-width: 1279px)"
      style={{ "--sidebar-width-mobile": "100vw" } as CSSProperties}
    >
      {shouldRenderSidebarChat ? (
        <AIChatPanel
          layoutMode="sidebar"
          isAIEnabled={profile.data_sharing_consent}
        />
      ) : null}
      <SidebarRail side="right" />
    </Sidebar>
  );
}
