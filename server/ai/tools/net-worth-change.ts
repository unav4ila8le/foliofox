"use server";

import { fetchNetWorthChange } from "@/server/analysis/net-worth-change";

interface GetNetWorthChangeParams {
  baseCurrency?: string;
  weeksBack?: number;
}

export async function getNetWorthChange(params: GetNetWorthChangeParams = {}) {
  const { baseCurrency, weeksBack = 24 } = params;

  const change = await fetchNetWorthChange({
    targetCurrency: baseCurrency,
    weeksBack,
  });

  return {
    baseCurrency,
    weeksBack,
    comparison: {
      current: {
        date: new Date().toISOString().split("T")[0],
        value: change.currentValue,
      },
      previous: {
        date: new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        value: change.previousValue,
      },
    },
    change: {
      absolute: change.absoluteChange,
      percentage: change.percentageChange,
      direction: change.absoluteChange >= 0 ? "positive" : "negative",
    },
  };
}
