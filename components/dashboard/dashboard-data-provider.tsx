"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { FinancialProfile, Profile } from "@/types/global.types";
import type { StalePosition } from "@/server/positions/stale";

type DashboardData = {
  profile: Profile;
  email: string;
  financialProfile: FinancialProfile | null;
  netWorth: number;
  /** Positions with stale symbols (last_quote_at NULL or > 7 days old) */
  stalePositions: StalePosition[];
};

const DashboardDataContext = createContext<DashboardData | undefined>(
  undefined,
);

export function DashboardDataProvider({
  value,
  children,
}: {
  value: DashboardData;
  children: ReactNode;
}) {
  return (
    <DashboardDataContext.Provider value={value}>
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
