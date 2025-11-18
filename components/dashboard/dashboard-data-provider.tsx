"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { FinancialProfile, Profile } from "@/types/global.types";

type DashboardData = {
  profile: Profile;
  email: string;
  financialProfile: FinancialProfile | null;
  netWorth: number;
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

export function useOptionalDashboardData() {
  return useContext(DashboardDataContext);
}
