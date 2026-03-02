"use server";

import { fetchNetWorthChange } from "@/server/analysis/net-worth/net-worth-change";
import { clampDaysBack } from "@/server/ai/tools/helpers/time-range";
import {
  parseNetWorthMode,
  type NetWorthMode,
} from "@/server/analysis/net-worth/types";

interface GetNetWorthChangeParams {
  baseCurrency: string | null;
  daysBack: number | null;
  mode: NetWorthMode | null;
}

export async function getNetWorthChange(params: GetNetWorthChangeParams) {
  const baseCurrency = params.baseCurrency ?? undefined;
  const daysBack = clampDaysBack({ requested: params.daysBack });
  const mode = parseNetWorthMode(params.mode);

  const change = await fetchNetWorthChange({
    targetCurrency: baseCurrency,
    daysBack,
    mode,
  });

  return {
    baseCurrency,
    daysBack,
    mode,
    comparison: {
      current: {
        date: change.currentDateKey,
        value: change.currentValue,
      },
      previous: {
        date: change.previousDateKey,
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
