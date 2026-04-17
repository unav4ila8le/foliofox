"use client";

import { useEffect, useRef } from "react";

import { touchLastAppActivity } from "@/server/profile/actions";

const LAST_APP_ACTIVITY_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

function getActivityStorageKey(userId: string) {
  return `foliofox:last-app-activity-sync:${userId}`;
}

function readLastSyncedTimestamp(userId: string): number | null {
  if (typeof window === "undefined") return null;

  const storedValue = window.localStorage.getItem(
    getActivityStorageKey(userId),
  );
  if (!storedValue) return null;

  const parsedValue = Number(storedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function writeLastSyncedTimestamp(userId: string, timestampMs: number) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getActivityStorageKey(userId),
    String(timestampMs),
  );
}

interface DashboardActivityTrackerProps {
  userId: string;
  lastAppActivityAt: string | null;
}

export function DashboardActivityTracker({
  userId,
  lastAppActivityAt,
}: DashboardActivityTrackerProps) {
  const isTouchingActivityRef = useRef(false);

  useEffect(() => {
    let isUnmounted = false;

    async function syncActivityIfNeeded() {
      if (isTouchingActivityRef.current) {
        return;
      }

      const nowTimestamp = Date.now();
      const lastSyncedTimestamp = readLastSyncedTimestamp(userId);
      const lastServerActivityTimestamp = lastAppActivityAt
        ? new Date(lastAppActivityAt).getTime()
        : null;
      const newestKnownTimestamp = Math.max(
        lastSyncedTimestamp ?? 0,
        lastServerActivityTimestamp ?? 0,
      );

      // Keep client-side traffic aligned with the same six-hour cooldown
      // enforced by the server action.
      if (
        newestKnownTimestamp > 0 &&
        nowTimestamp - newestKnownTimestamp < LAST_APP_ACTIVITY_MIN_INTERVAL_MS
      ) {
        return;
      }

      isTouchingActivityRef.current = true;

      try {
        const touchResult = await touchLastAppActivity();
        if (
          !isUnmounted &&
          touchResult.success &&
          typeof touchResult.lastAppActivityAt === "string"
        ) {
          writeLastSyncedTimestamp(
            userId,
            new Date(touchResult.lastAppActivityAt).getTime(),
          );
        }
      } finally {
        if (!isUnmounted) {
          isTouchingActivityRef.current = false;
        }
      }
    }

    function handleWindowFocus() {
      void syncActivityIfNeeded();
    }

    function handleDocumentVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncActivityIfNeeded();
      }
    }

    void syncActivityIfNeeded();

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener(
      "visibilitychange",
      handleDocumentVisibilityChange,
    );

    return () => {
      isUnmounted = true;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener(
        "visibilitychange",
        handleDocumentVisibilityChange,
      );
    };
  }, [lastAppActivityAt, userId]);

  // This component is behavior-only; no visible UI.
  return null;
}
