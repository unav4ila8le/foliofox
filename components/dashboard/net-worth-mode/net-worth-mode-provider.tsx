"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  NET_WORTH_MODE_COOKIE_NAME,
  parseNetWorthMode,
  type NetWorthMode,
} from "@/server/analysis/net-worth/types";

const NET_WORTH_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface NetWorthModeContextType {
  netWorthMode: NetWorthMode;
  isAfterCapitalGains: boolean;
  isRefreshing: boolean;
  setNetWorthModeAction: (nextMode: NetWorthMode) => void;
  toggleNetWorthMode: () => void;
}

const NetWorthModeContext = createContext<NetWorthModeContextType | undefined>(
  undefined,
);

function persistNetWorthMode(nextMode: NetWorthMode) {
  const secureSuffix = location.protocol === "https:" ? "; Secure" : "";

  document.cookie =
    `${NET_WORTH_MODE_COOKIE_NAME}=${encodeURIComponent(nextMode)}; Path=/; Max-Age=${NET_WORTH_MODE_COOKIE_MAX_AGE}; SameSite=Lax` +
    secureSuffix;

  try {
    window.localStorage.setItem(NET_WORTH_MODE_COOKIE_NAME, nextMode);
  } catch {
    // Ignore storage errors.
  }
}

export function NetWorthModeProvider({
  defaultMode,
  children,
}: {
  defaultMode: NetWorthMode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [netWorthMode, setNetWorthMode] = useState<NetWorthMode>(defaultMode);
  const netWorthModeRef = useRef(netWorthMode);

  useEffect(() => {
    netWorthModeRef.current = netWorthMode;
  }, [netWorthMode]);

  useEffect(() => {
    setNetWorthMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    const handleStorageEvent = (storageEvent: StorageEvent) => {
      if (storageEvent.key !== NET_WORTH_MODE_COOKIE_NAME) return;
      const nextMode = parseNetWorthMode(storageEvent.newValue);
      if (nextMode === netWorthModeRef.current) return;

      setNetWorthMode(nextMode);
      // Keep server-rendered data aligned when another tab updates mode.
      startRefreshTransition(() => {
        router.refresh();
      });
    };

    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, [router, startRefreshTransition]);

  const setNetWorthModeAction = useCallback(
    (nextMode: NetWorthMode) => {
      if (nextMode === netWorthMode) return;

      setNetWorthMode(nextMode);
      persistNetWorthMode(nextMode);

      startRefreshTransition(() => {
        router.refresh();
      });
    },
    [netWorthMode, router],
  );

  const toggleNetWorthMode = useCallback(() => {
    setNetWorthModeAction(
      netWorthMode === "gross" ? "after_capital_gains" : "gross",
    );
  }, [netWorthMode, setNetWorthModeAction]);

  const value = useMemo(
    () => ({
      netWorthMode,
      isAfterCapitalGains: netWorthMode === "after_capital_gains",
      isRefreshing,
      setNetWorthModeAction,
      toggleNetWorthMode,
    }),
    [netWorthMode, isRefreshing, setNetWorthModeAction, toggleNetWorthMode],
  );

  return (
    <NetWorthModeContext.Provider value={value}>
      {children}
    </NetWorthModeContext.Provider>
  );
}

export function useNetWorthMode() {
  const netWorthModeContext = useContext(NetWorthModeContext);
  if (!netWorthModeContext) {
    throw new Error(
      "useNetWorthMode must be used within <NetWorthModeProvider>",
    );
  }
  return netWorthModeContext;
}
