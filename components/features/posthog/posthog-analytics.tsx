"use client";

import { useEffect } from "react";

interface PostHogAnalyticsProps {
  user: { id: string; email: string | undefined } | null;
}

// Renders nothing — init/identify only, so analytics never gates the UI tree.
// posthog-js runs Date.now() at module scope, which Next.js rejects during
// prerendering — import it only in the browser, after mount.
export function PostHogAnalytics({ user }: PostHogAnalyticsProps) {
  const posthogEnabled =
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    !!process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!posthogEnabled) return;
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        defaults: "2025-05-24",
      });
    });
  }, [posthogEnabled]);

  useEffect(() => {
    if (!posthogEnabled) return;
    import("posthog-js").then(({ default: posthog }) => {
      if (user) {
        posthog.identify(user.id, { email: user.email });
      } else {
        posthog.reset();
      }
    });
  }, [posthogEnabled, user]);

  return null;
}
