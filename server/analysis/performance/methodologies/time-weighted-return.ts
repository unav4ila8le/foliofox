import type { CivilDateKey } from "@/lib/date/date-utils";

const VALUE_EPSILON = 1e-9;

export interface DailyPerformanceInput {
  dateKey: CivilDateKey;
  totalValue: number;
  netFlow: number;
}

export interface TimeWeightedReturnPoint {
  dateKey: CivilDateKey;
  cumulativeReturnPct: number;
}

/**
 * Build a cumulative TWR series from daily portfolio values and net flows.
 *
 * Assumptions:
 * - net flows are treated as start-of-day contributions/withdrawals
 * - the first valid point inside the requested range is rebased to 0%
 * - zero-exposure days carry the previous cumulative return forward
 *
 * The zero-exposure carry-forward keeps the MVP stable when a user fully exits
 * the symbol-backed sleeve, which would otherwise create a non-positive base.
 */
export function calculateTimeWeightedReturnSeries(
  rows: DailyPerformanceInput[],
): TimeWeightedReturnPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const firstActiveIndex = rows.findIndex(
    (row) => row.totalValue > VALUE_EPSILON,
  );
  if (firstActiveIndex === -1) {
    return [];
  }

  const series: TimeWeightedReturnPoint[] = [
    {
      dateKey: rows[firstActiveIndex].dateKey,
      cumulativeReturnPct: 0,
    },
  ];

  let cumulativeGrowthFactor = 1;

  for (
    let rowIndex = firstActiveIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const previousValue = rows[rowIndex - 1].totalValue;
    const { dateKey, totalValue, netFlow } = rows[rowIndex];
    const startingCapital = previousValue + netFlow;

    if (startingCapital > VALUE_EPSILON) {
      cumulativeGrowthFactor *= totalValue / startingCapital;
    }

    series.push({
      dateKey,
      cumulativeReturnPct: (cumulativeGrowthFactor - 1) * 100,
    });
  }

  return series;
}
