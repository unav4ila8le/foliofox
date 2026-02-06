"use server";

import { fetchNetWorthHistory } from "@/server/analysis/net-worth/net-worth-history";
import { clampDaysBack } from "@/server/ai/tools/helpers/time-range";
import {
  parseNetWorthMode,
  type NetWorthMode,
} from "@/server/analysis/net-worth/types";

interface GetNetWorthHistoryParams {
  baseCurrency: string | null;
  daysBack: number | null;
  mode: NetWorthMode | null;
}

export async function getNetWorthHistory(params: GetNetWorthHistoryParams) {
  const baseCurrency = params.baseCurrency ?? undefined;
  const daysBack = clampDaysBack({ requested: params.daysBack });
  const mode = parseNetWorthMode(params.mode);

  const history = await fetchNetWorthHistory({
    targetCurrency: baseCurrency,
    daysBack,
    mode,
  });

  const items = history.map((item) => ({
    date: item.date.toISOString().split("T")[0], // YYYY-MM-DD format
    value: item.value,
  }));

  return {
    total: history.length,
    returned: items.length,
    baseCurrency,
    daysBack,
    mode,
    period: {
      start: items[0]?.date ?? null,
      end: items[items.length - 1]?.date ?? null,
    },
    items,
  };
}
