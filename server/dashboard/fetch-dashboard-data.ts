"use server";

import { cache } from "react";

import { fetchProfile } from "@/server/profile/actions";
import { fetchEmailPreferences } from "@/server/email-preferences/actions";
import { fetchFinancialProfile } from "@/server/financial-profiles/actions";
import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import { fetchMarketDataStatuses } from "@/server/positions/stale";
import { hasActivePositions } from "@/server/positions/has-active";
import { resolveTodayDateKey } from "@/lib/date/date-utils";

import type { DashboardDataValue } from "@/components/dashboard/providers/dashboard-data-provider";

/**
 * Resolve everything <DashboardDataProvider> needs. Shared by the dashboard
 * layout and by /onboarding, which renders the same provider from outside the
 * (dashboard) route group.
 */
export const fetchDashboardData = cache(
  async (): Promise<DashboardDataValue> => {
    // 1) Resolve profile first because downstream analytics/valuation use profile context.
    const { profile, email } = await fetchProfile();
    const todayDateKey = resolveTodayDateKey(profile.time_zone);

    // 2) Keep the dashboard path fully data-driven; timezone auto-sync happens in
    // the background for auto-mode users without introducing a visible gate.
    const [
      emailPreferences,
      financialProfile,
      netWorth,
      marketDataStatuses,
      hasPositions,
    ] = await Promise.all([
      fetchEmailPreferences(),
      fetchFinancialProfile(),
      calculateNetWorth(profile.display_currency, todayDateKey),
      fetchMarketDataStatuses(),
      hasActivePositions(),
    ]);

    return {
      profile,
      emailPreferences,
      email,
      financialProfile,
      netWorth,
      hasActivePositions: hasPositions,
      marketDataStatuses,
    };
  },
);
