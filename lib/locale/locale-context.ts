"use client";

import { createContext } from "react";

import { DEFAULT_LOCALE } from "@/lib/locale/locale-constants";

export const LocaleContext = createContext<string>(DEFAULT_LOCALE);
