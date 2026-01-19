import { z } from "zod";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a date as a UTC date key in the format "yyyy-MM-dd".
 * @param date - The date to format
 * @returns The formatted date key
 */
export function formatUtcDateKey(date: Date): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid date provided to formatUtcDateKey");
  }

  return value.toISOString().slice(0, 10);
}

/**
 * Parse a YYYY-MM-DD date key into a UTC Date.
 * Returns Invalid Date for malformed inputs.
 * @param dateKey - The date key to parse
 * @returns Date at UTC midnight for the key
 */
export function parseUtcDateKey(dateKey: string): Date {
  const trimmed = dateKey.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) {
    return new Date(NaN);
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));

  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return new Date(NaN);
  }

  return value;
}

/**
 * LocalDate: A timezone-agnostic date representation
 * Uses year, month, day components instead of timestamps to avoid timezone issues
 */
export type LocalDate = {
  y: number; // year
  m: number; // month (1-12)
  d: number; // day (1-31)
};

export const LocalDate = z.object({
  y: z.number(),
  m: z.number(),
  d: z.number(),
});

export const ld = (y: number, m: number, d: number): LocalDate => ({
  y,
  m,
  d,
});

export const isAfterLD = (a: LocalDate, b: LocalDate): boolean => {
  if (a.y !== b.y) return a.y > b.y;
  if (a.m !== b.m) return a.m > b.m;
  return a.d > b.d;
};

export const addMonthsLD = (date: LocalDate, months: number): LocalDate => {
  let y = date.y;
  let m = date.m + months;

  while (m > 12) {
    m -= 12;
    y += 1;
  }

  while (m < 1) {
    m += 12;
    y -= 1;
  }

  return { y, m, d: date.d };
};

export const startOfMonthLD = (date: LocalDate): LocalDate => ({
  y: date.y,
  m: date.m,
  d: 1,
});

export const toKeyMonth = (date: LocalDate): string => {
  const month = date.m.toString().padStart(2, "0");
  return `${date.y}-${month}`;
};

export const isWithinIntervalLD = (
  date: LocalDate,
  interval: { start: LocalDate; end: LocalDate },
): boolean => {
  return !isAfterLD(date, interval.end) && !isAfterLD(interval.start, date);
};

export const fromJSDate = (date: Date): LocalDate => {
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1, // JS months are 0-11
    d: date.getDate(),
  };
};
