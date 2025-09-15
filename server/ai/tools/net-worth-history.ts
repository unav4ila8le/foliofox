"use server";

import { fetchNetWorthHistory } from "@/server/analysis/net-worth-history";

interface GetNetWorthHistoryParams {
  baseCurrency?: string;
  weeksBack?: number;
}

export async function getNetWorthHistory(
  params: GetNetWorthHistoryParams = {},
) {
  const { baseCurrency, weeksBack = 24 } = params;

  const history = await fetchNetWorthHistory({
    targetCurrency: baseCurrency,
    weeksBack,
  });

  const items = history.map((item) => ({
    date: item.date.toISOString().split("T")[0], // YYYY-MM-DD format
    value: item.value,
  }));

  return {
    total: history.length,
    returned: items.length,
    baseCurrency,
    weeksBack,
    period: {
      start: items[0]?.date ?? null,
      end: items[items.length - 1]?.date ?? null,
    },
    items,
  };
}
