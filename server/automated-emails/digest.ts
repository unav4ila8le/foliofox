"use server";

import { calculateNetWorth } from "@/server/analysis/net-worth/net-worth";
import {
  fetchPositions,
  type PositionsQueryContext,
} from "@/server/positions/fetch";
import { calculateProjectedIncome } from "@/server/analysis/projected-income/portfolio";
import { getTopMovers } from "@/server/ai/tools/top-movers";
import {
  addCivilDateKeyDays,
  addUTCDays,
  parseUTCDateKey,
  resolveTodayDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";
import {
  DEFAULT_DIGEST_COMPARISON_DAYS,
  DEFAULT_PROJECTED_INCOME_MONTHS_AHEAD,
  DEFAULT_PROJECTED_INCOME_WINDOW_DAYS,
  DEFAULT_TOP_MOVERS_LIMIT,
} from "@/server/automated-emails/constants";

import type { Profile, ProjectedIncomeData } from "@/types/global.types";

export interface AutomatedEmailDigestNetWorth {
  asOfDateKey: CivilDateKey;
  comparisonDateKey: CivilDateKey;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number;
}

export interface AutomatedEmailDigestTopMovers {
  analyzed: number;
  gainers: Awaited<ReturnType<typeof getTopMovers>>["topByPct"]["gainers"];
  losers: Awaited<ReturnType<typeof getTopMovers>>["topByPct"]["losers"];
}

export interface AutomatedEmailDigestProjectedIncome {
  currency: string;
  windowDays: number;
  monthsAhead: number;
  /**
   * Prorated income estimate for the configured rolling window starting at
   * `asOfDateKey`. Defaults to the next 30 days but follows
   * `projectedIncomeWindowDays` when overridden.
   */
  windowEstimate: number;
  monthlySeries: ProjectedIncomeData[];
}

export interface AutomatedEmailDigest {
  userId: string;
  currency: string;
  activePositionCount: number;
  netWorth: AutomatedEmailDigestNetWorth;
  topMovers: AutomatedEmailDigestTopMovers | null;
  projectedIncome: AutomatedEmailDigestProjectedIncome | null;
}

export type AutomatedEmailDigestResult =
  | {
      eligible: false;
      reason: "no_active_positions";
    }
  | {
      eligible: true;
      digest: AutomatedEmailDigest;
    };

export interface BuildAutomatedEmailDigestInput {
  profile: Pick<Profile, "user_id" | "display_currency" | "time_zone">;
  positionsQueryContext?: PositionsQueryContext;
  comparisonDays?: number;
  topMoversLimit?: number;
  projectedIncomeWindowDays?: number;
  projectedIncomeMonthsAhead?: number;
}

function calculateRollingProjectedIncomeTotal(params: {
  monthlySeries: ProjectedIncomeData[];
  asOfDateKey: CivilDateKey;
  windowDays: number;
}) {
  const { monthlySeries, asOfDateKey, windowDays } = params;
  const windowStart = parseUTCDateKey(asOfDateKey);
  const windowEndExclusive = addUTCDays(windowStart, windowDays);

  return monthlySeries.reduce((runningTotal, monthBucket) => {
    // Projected income currently comes in month buckets. To build a rolling
    // window estimate, prorate each bucket by the number of overlapping days.
    const monthStart = new Date(
      Date.UTC(monthBucket.date.getFullYear(), monthBucket.date.getMonth(), 1),
    );
    const monthEndExclusive = new Date(
      Date.UTC(
        monthBucket.date.getFullYear(),
        monthBucket.date.getMonth() + 1,
        1,
      ),
    );

    const overlapStart = Math.max(monthStart.getTime(), windowStart.getTime());
    const overlapEnd = Math.min(
      monthEndExclusive.getTime(),
      windowEndExclusive.getTime(),
    );

    if (overlapEnd <= overlapStart) {
      return runningTotal;
    }

    const monthDurationMs = monthEndExclusive.getTime() - monthStart.getTime();
    const overlapDurationMs = overlapEnd - overlapStart;

    return (
      runningTotal + monthBucket.income * (overlapDurationMs / monthDurationMs)
    );
  }, 0);
}

/**
 * Build the reusable analytics payload shared by automated email templates.
 */
export async function buildAutomatedEmailDigest(
  input: BuildAutomatedEmailDigestInput,
): Promise<AutomatedEmailDigestResult> {
  const comparisonDays = Math.max(
    1,
    Math.trunc(input.comparisonDays ?? DEFAULT_DIGEST_COMPARISON_DAYS),
  );
  const topMoversLimit = Math.max(
    1,
    Math.trunc(input.topMoversLimit ?? DEFAULT_TOP_MOVERS_LIMIT),
  );
  const projectedIncomeWindowDays = Math.max(
    1,
    Math.trunc(
      input.projectedIncomeWindowDays ?? DEFAULT_PROJECTED_INCOME_WINDOW_DAYS,
    ),
  );
  const projectedIncomeMonthsAhead = Math.max(
    1,
    Math.trunc(
      input.projectedIncomeMonthsAhead ?? DEFAULT_PROJECTED_INCOME_MONTHS_AHEAD,
    ),
  );
  const asOfDateKey = resolveTodayDateKey(input.profile.time_zone);
  const comparisonDateKey = addCivilDateKeyDays(asOfDateKey, -comparisonDays);

  // 1. Short-circuit empty portfolios before running heavier analytics.
  const activePositions = await fetchPositions(
    {
      positionType: "asset",
      includeArchived: false,
      asOfDateKey,
    },
    input.positionsQueryContext,
  );

  if (activePositions.length === 0) {
    return {
      eligible: false,
      reason: "no_active_positions",
    };
  }

  // 2. Reuse existing analytics helpers for valuation, movers, and income.
  const [currentNetWorth, previousNetWorth, topMovers, projectedIncome] =
    await Promise.all([
      calculateNetWorth(
        input.profile.display_currency,
        asOfDateKey,
        input.positionsQueryContext,
      ),
      calculateNetWorth(
        input.profile.display_currency,
        comparisonDateKey,
        input.positionsQueryContext,
      ),
      getTopMovers({
        baseCurrency: input.profile.display_currency,
        startDate: comparisonDateKey,
        endDate: asOfDateKey,
        limit: topMoversLimit,
        todayDateKey: asOfDateKey,
        positionsQueryContext: input.positionsQueryContext,
      }),
      calculateProjectedIncome(
        input.profile.display_currency,
        projectedIncomeMonthsAhead,
        input.positionsQueryContext,
        asOfDateKey,
      ),
    ]);

  const absoluteChange = currentNetWorth - previousNetWorth;
  const percentageChange =
    previousNetWorth !== 0 ? (absoluteChange / previousNetWorth) * 100 : 0;

  const hasTopMovers =
    topMovers.analyzed > 0 &&
    (topMovers.topByPct.gainers.length > 0 ||
      topMovers.topByPct.losers.length > 0);

  const monthlyProjectedIncomeSeries =
    projectedIncome.success && projectedIncome.data?.length
      ? projectedIncome.data
      : [];

  return {
    eligible: true,
    digest: {
      userId: input.profile.user_id,
      currency: input.profile.display_currency,
      activePositionCount: activePositions.length,
      netWorth: {
        asOfDateKey,
        comparisonDateKey,
        currentValue: currentNetWorth,
        previousValue: previousNetWorth,
        absoluteChange,
        percentageChange,
      },
      topMovers: hasTopMovers
        ? {
            analyzed: topMovers.analyzed,
            gainers: topMovers.topByPct.gainers,
            losers: topMovers.topByPct.losers,
          }
        : null,
      projectedIncome:
        monthlyProjectedIncomeSeries.length > 0
          ? {
              currency:
                projectedIncome.currency ?? input.profile.display_currency,
              windowDays: projectedIncomeWindowDays,
              monthsAhead: projectedIncomeMonthsAhead,
              windowEstimate: calculateRollingProjectedIncomeTotal({
                monthlySeries: monthlyProjectedIncomeSeries,
                asOfDateKey,
                windowDays: projectedIncomeWindowDays,
              }),
              monthlySeries: monthlyProjectedIncomeSeries,
            }
          : null,
    },
  };
}
