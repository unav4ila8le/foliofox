import {
  addCivilDateKeyDays,
  toCivilDateKey,
  type CivilDateKey,
} from "@/lib/date/date-utils";

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
  todayDateKey: CivilDateKey;
}

export function clampDateRange({
  startDate,
  endDate,
  maxDays = DEFAULT_MAX_HISTORY_DAYS,
  todayDateKey,
}: ClampDateRangeOptions): { startDate: CivilDateKey; endDate: CivilDateKey } {
  // 1. Clamp end date to an allowed civil day (never beyond today).
  const parsedEndDateKey = endDate ? toCivilDateKey(endDate) : null;
  const safeEndDateKey =
    parsedEndDateKey && parsedEndDateKey <= todayDateKey
      ? parsedEndDateKey
      : todayDateKey;

  // 2. Clamp start date inside [safeEnd-(maxDays-1), safeEnd].
  const maxLookbackStartDateKey = addCivilDateKeyDays(
    safeEndDateKey,
    -Math.max(0, maxDays - 1),
  );
  let safeStartDateKey =
    (startDate ? toCivilDateKey(startDate) : null) ?? maxLookbackStartDateKey;

  if (safeStartDateKey > safeEndDateKey) {
    safeStartDateKey = maxLookbackStartDateKey;
  }

  if (safeStartDateKey < maxLookbackStartDateKey) {
    safeStartDateKey = maxLookbackStartDateKey;
  }

  return {
    startDate: safeStartDateKey,
    endDate: safeEndDateKey,
  };
}
