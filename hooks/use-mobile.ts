"use client";

import { useMediaQuery } from "./use-media-query";

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
