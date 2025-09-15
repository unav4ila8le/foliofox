"use server";

import { calculateProjectedIncome } from "@/server/analysis/projected-income";

interface GetProjectedIncomeParams {
  baseCurrency?: string;
  monthsAhead?: number;
}

export async function getProjectedIncome(
  params: GetProjectedIncomeParams = {},
) {
  const { baseCurrency, monthsAhead = 12 } = params;

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
