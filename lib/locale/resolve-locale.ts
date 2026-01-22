import { cache } from "react";
import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE } from "@/lib/locale/locale-constants";

export const resolveLocale = cache(
  async (preferredLocale?: string | null): Promise<string> => {
    if (preferredLocale) {
      return preferredLocale;
    }

    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("locale")?.value;
    if (cookieLocale) {
      return cookieLocale;
    }

    const headerStore = await headers();
    const acceptLanguage = headerStore.get("accept-language");
    const headerLocale = acceptLanguage?.split(",")[0]?.trim();
    return headerLocale || DEFAULT_LOCALE;
  },
);

export const getRequestLocale = (): Promise<string> => resolveLocale();
