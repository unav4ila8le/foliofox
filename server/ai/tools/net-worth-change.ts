"use server";

import { fetchNetWorthChange } from "@/server/analysis/net-worth-change";

interface GetNetWorthChangeParams {
  baseCurrency: string | null;
  daysBack: number | null;
}

export async function getNetWorthChange(params: GetNetWorthChangeParams) {
  const baseCurrency = params.baseCurrency ?? undefined;
  const daysBack = params.daysBack ?? 180;

  const change = await fetchNetWorthChange({
    targetCurrency: baseCurrency,
    daysBack,
  });

  return {
    baseCurrency,
    daysBack,
    comparison: {
      current: {
        date: new Date().toISOString().split("T")[0],
        value: change.currentValue,
      },
      previous: {
        date: (() => {
          const previousDate = new Date();
          previousDate.setDate(previousDate.getDate() - daysBack);
          return previousDate.toISOString().split("T")[0];
        })(),
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
