"use server";

import { headers } from "next/headers";

/**
 * Resolve the canonical site origin for absolute links in emails and shared
 * metadata. Prefer the configured public URL, then fall back to request
 * headers when available.
 */
export async function resolveSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

    if (host) {
      const protocol =
        headerStore.get("x-forwarded-proto") ??
        (host.includes("localhost") ? "http" : "https");

      return `${protocol}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Ignore header resolution issues outside request scope.
  }

  return "http://localhost:3000";
}
