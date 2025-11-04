"use server";

import { calculateProjectedIncome } from "@/server/analysis/projected-income";
import { fetchProfile } from "@/server/profile/actions";

interface GetProjectedIncomeParams {
  baseCurrency: string | null;
  monthsAhead: number | null;
}

export async function getProjectedIncome(params: GetProjectedIncomeParams) {
  const baseCurrency =
    params.baseCurrency ??
    (await fetchProfile()).profile.display_currency;
  const monthsAhead = params.monthsAhead ?? 12;

  const result = await calculateProjectedIncome(baseCurrency, monthsAhead);

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
      date: item.date.toISOString().split("T")[0], // YYYY-MM-DD format
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
