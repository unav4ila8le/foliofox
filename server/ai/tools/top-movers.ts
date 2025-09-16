"use server";

import { getHoldingsPerformance } from "./holdings-performance";

interface GetTopMoversParams {
  baseCurrency?: string;
  startDate?: string;
  endDate?: string;
  limit?: number; // defaults to 5
}

export async function getTopMovers(params: GetTopMoversParams = {}) {
  const { baseCurrency, startDate, endDate, limit = 5 } = params;

  const perf = await getHoldingsPerformance({
    baseCurrency,
    startDate,
    endDate,
  });

  const holdings = perf.holdings;

  const byPct = [...holdings].sort(
    (a, b) => b.performance.priceReturnPct - a.performance.priceReturnPct,
  );
  const byAbs = [...holdings].sort(
    (a, b) => b.performance.valueChangeAbs - a.performance.valueChangeAbs,
  );

  const mapItem = (h: (typeof holdings)[number]) => ({
    holding: h.holding,
    startValue: h.value.startBase,
    endValue: h.value.endBase,
    priceReturnPct: h.performance.priceReturnPct,
    valueChangeAbs: h.performance.valueChangeAbs,
    valueChangePct: h.performance.valueChangePct,
    partialPeriod: h.period.partialPeriod,
  });

  const gainersByPct = byPct.slice(0, limit).map(mapItem);
  const losersByPct = byPct.slice(-limit).reverse().map(mapItem);

  const gainersByAbs = byAbs.slice(0, limit).map(mapItem);
  const losersByAbs = byAbs.slice(-limit).reverse().map(mapItem);

  const partialCount = holdings.reduce(
    (acc, h) => acc + (h.period.partialPeriod ? 1 : 0),
    0,
  );

  return {
    summary: `Top movers among ${holdings.length} holdings`,
    baseCurrency: perf.period.baseCurrency,
    period: {
      startDate: perf.period.startDate,
      endDate: perf.period.endDate,
      daysCount: perf.period.daysCount,
    },
    limit,
    analyzed: holdings.length,
    partialPeriodCount: partialCount,
    topByPct: {
      gainers: gainersByPct,
      losers: losersByPct,
    },
    topByAbs: {
      gainers: gainersByAbs,
      losers: losersByAbs,
    },
  };
}
