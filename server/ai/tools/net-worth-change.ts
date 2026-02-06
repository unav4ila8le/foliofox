"use server";

import { fetchNetWorthChange } from "@/server/analysis/net-worth/net-worth-change";
import { clampDaysBack } from "@/server/ai/tools/helpers/time-range";
import {
  addUTCDays,
  formatUTCDateKey,
  startOfUTCDay,
} from "@/lib/date/date-utils";
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
  const today = startOfUTCDay(new Date());

  return {
    baseCurrency,
    daysBack,
    mode,
    comparison: {
      current: {
        date: formatUTCDateKey(today),
        value: change.currentValue,
      },
      previous: {
        date: formatUTCDateKey(addUTCDays(today, -daysBack)),
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
