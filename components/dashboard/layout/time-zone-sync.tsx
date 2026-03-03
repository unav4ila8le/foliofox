"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resolveBrowserTimeZone } from "@/lib/date/time-zone";
import { syncProfileTimeZone } from "@/server/profile/actions";

/**
 * Sync the provided browser timezone with server profile state.
 * Returns true only when persisted timezone actually changed.
 */
async function syncDetectedTimeZone(
  detectedTimeZone: string,
): Promise<boolean> {
  const syncResult = await syncProfileTimeZone(detectedTimeZone);
  return syncResult.success && syncResult.changed;
}

interface TimeZoneAutoSyncProps {
  currentTimeZone: string | null;
}

export function TimeZoneAutoSync({ currentTimeZone }: TimeZoneAutoSyncProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current) {
      return;
    }
    hasSyncedRef.current = true;

    let isUnmounted = false;

    // Keep auto-mode users aligned with browser timezone changes.
    async function runAutoSync() {
      const detectedTimeZone = resolveBrowserTimeZone();
      if (!detectedTimeZone || detectedTimeZone === currentTimeZone) {
        return;
      }

      const didChangeProfileTimeZone =
        await syncDetectedTimeZone(detectedTimeZone);

      if (isUnmounted) {
        return;
      }

      if (didChangeProfileTimeZone) {
        startRefreshTransition(() => {
          router.refresh();
        });
      }
    }

    void runAutoSync();

    return () => {
      isUnmounted = true;
    };
  }, [currentTimeZone, router, startRefreshTransition]);

  // This component is behavior-only; no visible UI.
  return null;
}
