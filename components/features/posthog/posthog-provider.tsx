"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogProviderProps {
  children: React.ReactNode;
  user: { id: string; email: string | undefined } | null;
}

export function PostHogProvider({ children, user }: PostHogProviderProps) {
  useEffect(() => {
    if (user) {
      // User is authenticated - identify them
      posthog.identify(user.id, {
        email: user.email,
      });
    } else {
      // User is not authenticated - reset PostHog identity
      posthog.reset();
    }
  }, [user]);

  return <>{children}</>;
}
