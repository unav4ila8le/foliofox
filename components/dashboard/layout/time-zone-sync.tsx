"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resolveBrowserTimeZone } from "@/lib/date/time-zone";
import { syncProfileTimeZone } from "@/server/profile/actions";

/**
 * 1) Resolve browser timezone.
 * 2) Sync with server using the idempotent server action.
 * 3) Return whether persisted profile state changed.
 */
async function syncDetectedTimeZone(): Promise<boolean> {
  const detectedTimeZone = resolveBrowserTimeZone();

  if (!detectedTimeZone) {
    return false;
  }

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

      const didChangeProfileTimeZone = await syncDetectedTimeZone();

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
