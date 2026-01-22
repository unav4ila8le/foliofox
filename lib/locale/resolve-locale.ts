import { cache } from "react";
import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE } from "@/lib/locale/locale-constants";

function normalizeLocale(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const candidate = value.split(",")[0]?.split(";")[0]?.trim();
  if (!candidate || candidate === "*") {
    return null;
  }

  try {
    const [supported] = Intl.NumberFormat.supportedLocalesOf([candidate]);
    return supported || null;
  } catch {
    return null;
  }
}

export const resolveLocale = cache(
  async (preferredLocale?: string | null): Promise<string> => {
    const resolvedPreferredLocale = normalizeLocale(preferredLocale);
    if (resolvedPreferredLocale) {
      return resolvedPreferredLocale;
    }

    const cookieStore = await cookies();
    const resolvedCookieLocale = normalizeLocale(
      cookieStore.get("locale")?.value,
    );
    if (resolvedCookieLocale) {
      return resolvedCookieLocale;
    }

    const headerStore = await headers();
    const acceptLanguage = headerStore.get("accept-language");
    const resolvedHeaderLocale = normalizeLocale(acceptLanguage);
    return resolvedHeaderLocale || DEFAULT_LOCALE;
  },
);

export const getRequestLocale = (): Promise<string> => resolveLocale();
