import {
  formatUTCDateKey,
  parseUTCDateKey,
  toCivilDateKeyOrThrow,
  type CivilDateKey,
} from "@/lib/date/date-utils";

export type ChartTimeRange = "1m" | "3m" | "6m" | "ytd" | "1y" | "2y";

export const DEFAULT_TIME_RANGE: ChartTimeRange = "3m";

export const TIME_RANGE_LABELS: Record<
  ChartTimeRange,
  { short: string; long: string }
> = {
  "1m": { short: "1M", long: "1 Month" },
  "3m": { short: "3M", long: "3 Months" },
  "6m": { short: "6M", long: "6 Months" },
  ytd: { short: "YTD", long: "YTD" },
  "1y": { short: "1Y", long: "1 Year" },
  "2y": { short: "2Y", long: "2 Years" },
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getCivilDateParts(dateKey: CivilDateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftCivilDateKeyMonths(
  dateKey: CivilDateKey,
  monthDelta: number,
): CivilDateKey {
  const { year, month, day } = getCivilDateParts(dateKey);
  const zeroBasedMonth = month - 1;
  const shiftedMonthIndex = zeroBasedMonth + monthDelta;
  const normalizedYear = year + Math.floor(shiftedMonthIndex / 12);
  const normalizedMonth = ((shiftedMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(
    day,
    getDaysInMonth(normalizedYear, normalizedMonth + 1),
  );

  return toCivilDateKeyOrThrow(
    formatUTCDateKey(
      new Date(Date.UTC(normalizedYear, normalizedMonth, clampedDay)),
    ),
  );
}

function shiftCivilDateKeyYears(
  dateKey: CivilDateKey,
  yearDelta: number,
): CivilDateKey {
  return shiftCivilDateKeyMonths(dateKey, yearDelta * 12);
}

function differenceInCivilDateKeysInclusive(
  startDateKey: CivilDateKey,
  endDateKey: CivilDateKey,
) {
  const startDate = parseUTCDateKey(startDateKey);
  const endDate = parseUTCDateKey(endDateKey);

  return (
    Math.floor(
      (endDate.getTime() - startDate.getTime()) / DAY_IN_MILLISECONDS,
    ) + 1
  );
}

export function resolveDaysBackForRange(
  value: ChartTimeRange,
  todayDateKey: CivilDateKey,
) {
  switch (value) {
    case "1m":
      return differenceInCivilDateKeysInclusive(
        shiftCivilDateKeyMonths(todayDateKey, -1),
        todayDateKey,
      );
    case "3m":
      return differenceInCivilDateKeysInclusive(
        shiftCivilDateKeyMonths(todayDateKey, -3),
        todayDateKey,
      );
    case "6m":
      return differenceInCivilDateKeysInclusive(
        shiftCivilDateKeyMonths(todayDateKey, -6),
        todayDateKey,
      );
    case "ytd":
      return differenceInCivilDateKeysInclusive(
        toCivilDateKeyOrThrow(`${todayDateKey.slice(0, 4)}-01-01`),
        todayDateKey,
      );
    case "1y":
      return differenceInCivilDateKeysInclusive(
        shiftCivilDateKeyYears(todayDateKey, -1),
        todayDateKey,
      );
    case "2y":
      return differenceInCivilDateKeysInclusive(
        shiftCivilDateKeyYears(todayDateKey, -2),
        todayDateKey,
      );
  }
}
