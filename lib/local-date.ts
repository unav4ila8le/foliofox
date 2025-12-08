/**
 * LocalDate: A timezone-agnostic date representation
 * Uses year, month, day components instead of timestamps to avoid timezone issues
 */
import { z } from "zod";

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
    m: date.getMonth() + 1, // JS months are 0–11
    d: date.getDate(),
  };
};
