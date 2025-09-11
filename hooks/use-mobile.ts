"use client";

import { useMediaQuery } from "./use-media-query";

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
