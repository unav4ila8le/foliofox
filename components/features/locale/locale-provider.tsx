"use client";

import { LocaleContext } from "@/lib/locale/locale-context";

interface LocaleProviderProps {
  children: React.ReactNode;
  locale: string;
}

export function LocaleProvider({ children, locale }: LocaleProviderProps) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
