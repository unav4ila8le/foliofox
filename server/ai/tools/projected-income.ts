"use server";

import { formatLocalDateKey, resolveTodayDateKey } from "@/lib/date/date-utils";
import { calculateProjectedIncome } from "@/server/analysis/projected-income/portfolio";
import { fetchProfile } from "@/server/profile/actions";

interface GetProjectedIncomeParams {
  baseCurrency: string | null;
  monthsAhead: number | null;
}

export async function getProjectedIncome(params: GetProjectedIncomeParams) {
  const { profile } = await fetchProfile();
  const baseCurrency = params.baseCurrency ?? profile.display_currency;
  const todayDateKey = resolveTodayDateKey(profile.time_zone);
  const monthsAhead = Math.min(Math.max(params.monthsAhead ?? 12, 1), 24);

  const result = await calculateProjectedIncome(
    baseCurrency,
    monthsAhead,
    undefined,
    todayDateKey,
  );

  if (!result.success) {
    return {
      success: false,
      message: result.message,
      baseCurrency,
      monthsAhead,
      data: [],
    };
  }

  const items =
    result.data?.map((item) => ({
      date: formatLocalDateKey(item.date),
      income: item.income,
    })) || [];

  return {
    success: true,
    baseCurrency: result.currency || baseCurrency,
    monthsAhead,
    period: {
      start: items[0]?.date ?? null,
      end: items[items.length - 1]?.date ?? null,
    },
    total: items.length,
    returned: items.length,
    message: result.message,
    items,
  };
}
