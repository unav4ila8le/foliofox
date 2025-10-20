"use server";

import { getAssetsPerformance } from "./assets-performance";

interface GetTopMoversParams {
  baseCurrency?: string;
  startDate?: string;
  endDate?: string;
  limit?: number; // defaults to 5
}

export async function getTopMovers(params: GetTopMoversParams = {}) {
  const { baseCurrency, startDate, endDate, limit = 5 } = params;

  const perf = await getAssetsPerformance({ baseCurrency, startDate, endDate });

  const assets = perf.assets;

  const byPct = [...assets].sort(
    (a, b) => b.performance.priceReturnPct - a.performance.priceReturnPct,
  );
  const byAbs = [...assets].sort(
    (a, b) => b.performance.valueChangeAbs - a.performance.valueChangeAbs,
  );

  const mapItem = (a: (typeof assets)[number]) => ({
    asset: a.asset,
    startValue: a.value.startBase,
    endValue: a.value.endBase,
    priceReturnPct: a.performance.priceReturnPct,
    valueChangeAbs: a.performance.valueChangeAbs,
    valueChangePct: a.performance.valueChangePct,
    partialPeriod: a.period.partialPeriod,
  });

  const gainersByPct = byPct.slice(0, limit).map(mapItem);
  const losersByPct = byPct.slice(-limit).reverse().map(mapItem);

  const gainersByAbs = byAbs.slice(0, limit).map(mapItem);
  const losersByAbs = byAbs.slice(-limit).reverse().map(mapItem);

  const partialCount = assets.reduce(
    (acc, a) => acc + (a.period.partialPeriod ? 1 : 0),
    0,
  );

  return {
    summary: `Top movers among ${assets.length} assets`,
    baseCurrency: perf.period.baseCurrency,
    period: {
      startDate: perf.period.startDate,
      endDate: perf.period.endDate,
      daysCount: perf.period.daysCount,
    },
    limit,
    analyzed: assets.length,
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
