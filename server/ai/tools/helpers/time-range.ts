import { format, isValid, parseISO, subDays } from "date-fns";

export const DEFAULT_MAX_HISTORY_DAYS = 365; // ~1 year

interface ClampDaysBackOptions {
  requested: number | null | undefined;
  min?: number;
  max?: number;
}

export function clampDaysBack({
  requested,
  min = 1,
  max = DEFAULT_MAX_HISTORY_DAYS,
}: ClampDaysBackOptions): number {
  const value =
    typeof requested === "number" ? requested : DEFAULT_MAX_HISTORY_DAYS;
  const bounded = Math.min(Math.max(min, Math.trunc(value)), max);
  return bounded;
}

interface ClampDateRangeOptions {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  maxDays?: number;
}

export function clampDateRange({
  startDate,
  endDate,
  maxDays = DEFAULT_MAX_HISTORY_DAYS,
}: ClampDateRangeOptions): { startDate: string; endDate: string } {
  const today = new Date();
  const parsedEnd = endDate ? parseISO(endDate) : today;
  const safeEnd = isValid(parsedEnd)
    ? parsedEnd > today
      ? today
      : parsedEnd
    : today;

  const maxLookbackStart = subDays(safeEnd, Math.max(0, maxDays - 1));

  const parsedStart = startDate ? parseISO(startDate) : maxLookbackStart;
  let safeStart = isValid(parsedStart) ? parsedStart : maxLookbackStart;

  if (safeStart > safeEnd) {
    safeStart = maxLookbackStart;
  }

  if (safeStart < maxLookbackStart) {
    safeStart = maxLookbackStart;
  }

  return {
    startDate: format(safeStart, "yyyy-MM-dd"),
    endDate: format(safeEnd, "yyyy-MM-dd"),
  };
}
