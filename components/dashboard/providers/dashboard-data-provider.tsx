"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type {
  EmailPreferences,
  FinancialProfile,
  Profile,
} from "@/types/global.types";
import type { MarketDataStatus } from "@/server/positions/stale";

type DashboardDataValue = {
  profile: Profile;
  emailPreferences: EmailPreferences;
  email: string;
  financialProfile: FinancialProfile | null;
  netWorth: number;
  /** Whether the user has at least one non-archived position. */
  hasActivePositions: boolean;
  /** Positions whose linked market data is stale or intentionally unavailable. */
  marketDataStatuses: MarketDataStatus[];
};

type DashboardData = DashboardDataValue & {
  /** Increments when a dashboard mutation should refresh local client caches. */
  dashboardDataVersion: number;
  refreshDashboardData: () => void;
};

const DashboardDataContext = createContext<DashboardData | undefined>(
  undefined,
);

export function DashboardDataProvider({
  value,
  children,
}: {
  value: DashboardDataValue;
  children: ReactNode;
}) {
  const router = useRouter();
  const [dashboardDataVersion, setDashboardDataVersion] = useState(0);
  const [, startRefreshTransition] = useTransition();

  const refreshDashboardData = useCallback(() => {
    setDashboardDataVersion((currentVersion) => currentVersion + 1);

    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router]);

  const contextValue = useMemo(
    () => ({
      ...value,
      dashboardDataVersion,
      refreshDashboardData,
    }),
    [value, dashboardDataVersion, refreshDashboardData],
  );

  return (
    <DashboardDataContext.Provider value={contextValue}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error(
      "useDashboardData must be used within <DashboardDataProvider>",
    );
  }
  return context;
}
