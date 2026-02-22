"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AI_CHAT_ROUTE } from "@/components/dashboard/ai-chat/navigation";
import {
  Sidebar,
  SidebarRail,
  useSidebar,
} from "@/components/ui/custom/sidebar";
import { AIAdvisor } from "./ai-advisor";

export function RightSidebar() {
  const pathname = usePathname();
  const { openRight, openMobileRight, setOpenRight, setOpenMobileRight } =
    useSidebar();
  const previousOpenRightRef = useRef<boolean | null>(null);
  const previousOpenMobileRightRef = useRef<boolean | null>(null);
  const isLockActiveRef = useRef(false);

  const isAIChatRoute = pathname === AI_CHAT_ROUTE;

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
      <AIAdvisor />
      <SidebarRail side="right" />
    </Sidebar>
  );
}
