"use client";

import { useContext } from "react";

import { LocaleContext } from "@/lib/locale/locale-context";
import { DEFAULT_LOCALE } from "@/lib/locale/locale-constants";

export function useLocale(): string {
  const locale = useContext(LocaleContext);
  return locale || DEFAULT_LOCALE;
}
