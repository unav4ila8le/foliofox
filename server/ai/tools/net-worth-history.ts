"use server";

import { fetchNetWorthHistory } from "@/server/analysis/net-worth/net-worth-history";
import { clampDaysBack } from "@/server/ai/tools/helpers/time-range";

interface GetNetWorthHistoryParams {
  baseCurrency: string | null;
  daysBack: number | null;
}

export async function getNetWorthHistory(params: GetNetWorthHistoryParams) {
  const baseCurrency = params.baseCurrency ?? undefined;
  const daysBack = clampDaysBack({ requested: params.daysBack });

  const history = await fetchNetWorthHistory({
    targetCurrency: baseCurrency,
    daysBack,
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
    period: {
      start: items[0]?.date ?? null,
      end: items[items.length - 1]?.date ?? null,
    },
    items,
  };
}
