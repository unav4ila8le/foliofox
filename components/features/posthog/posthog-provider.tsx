"use client";

import { useEffect } from "react";
import { PostHogProvider as PHProvider } from "@posthog/react";
import posthog from "posthog-js";

interface PostHogProviderProps {
  children: React.ReactNode;
  user: { id: string; email: string | undefined } | null;
}

export function PostHogProvider({ children, user }: PostHogProviderProps) {
  const posthogEnabled =
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    !!process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!posthogEnabled) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2025-05-24",
    });
  }, [posthogEnabled]);

  useEffect(() => {
    if (!posthogEnabled) return;
    if (user) {
      posthog.identify(user.id, { email: user.email });
    } else {
      posthog.reset();
    }
  }, [posthogEnabled, user]);

  if (!posthogEnabled) return children;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
