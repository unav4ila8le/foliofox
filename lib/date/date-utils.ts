import { z } from "zod";

type DateInput = Date | string | number;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_PARTS_FORMATTER_LOCALE = "en-US";

declare const civilDateKeyBrand: unique symbol;
declare const utcDateKeyBrand: unique symbol;

export type CivilDateKey = string & { readonly [civilDateKeyBrand]: true };
export type UTCDateKey = string & { readonly [utcDateKeyBrand]: true };

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isValidDateKeyString(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));

  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() === month - 1 &&
    normalized.getUTCDate() === day
  );
}

/**
 * Build a branded civil date key from a validated YYYY-MM-DD value.
 * Returns null instead of throwing to keep parser callsites ergonomic.
 */
export function toCivilDateKey(value: string): CivilDateKey | null {
  const trimmed = value.trim();
  if (!isValidDateKeyString(trimmed)) {
    return null;
  }

  return trimmed as CivilDateKey;
}

/**
 * Build a branded civil date key and throw when input is invalid.
 */
export function toCivilDateKeyOrThrow(value: string): CivilDateKey {
  const dateKey = toCivilDateKey(value);
  if (!dateKey) {
    throw new Error("Invalid civil date key");
  }

  return dateKey;
}

/**
 * Build a branded UTC date key from a validated YYYY-MM-DD value.
 * Returns null instead of throwing to keep parser callsites ergonomic.
 */
export function toUTCDateKey(value: string): UTCDateKey | null {
  const trimmed = value.trim();
  if (!isValidDateKeyString(trimmed)) {
    return null;
  }

  return trimmed as UTCDateKey;
}

function formatDateKeyPartsInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat(DATE_PARTS_FORMATTER_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date key parts for timezone");
  }

  return `${year}-${month}-${day}`;
}

/**
 * Format a date as a civil YYYY-MM-DD key in a specific timezone.
 */
export function formatDateKeyInTimeZone(
  date: DateInput,
  timeZone: string,
): CivilDateKey {
  const value = toDate(date);
  if (!value) {
    throw new Error("Invalid date provided to formatDateKeyInTimeZone");
  }

  const formatted = formatDateKeyPartsInTimeZone(value, timeZone);
  const dateKey = toCivilDateKey(formatted);

  if (!dateKey) {
    throw new Error("Failed to produce a valid civil date key");
  }

  return dateKey;
}

/**
 * Resolve today's civil date key for a timezone, optionally injecting "now".
 */
export function resolveTodayDateKey(
  timeZone: string,
  now: DateInput = new Date(),
): CivilDateKey {
  return formatDateKeyInTimeZone(now, timeZone);
}

/**
 * Shift a civil date key by N calendar days.
 * Uses UTC date arithmetic as a deterministic carrier to avoid DST drift.
 */
export function addCivilDateKeyDays(
  dateKey: CivilDateKey,
  days: number,
): CivilDateKey {
  const parsed = parseUTCDateKey(dateKey);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid civil date key provided to addCivilDateKeyDays");
  }

  return toCivilDateKeyOrThrow(formatUTCDateKey(addUTCDays(parsed, days)));
}

/**
 * Build an inclusive civil date-key range from start to end.
 */
export function buildCivilDateKeyRange(
  startDateKey: CivilDateKey,
  endDateKey: CivilDateKey,
): CivilDateKey[] {
  if (startDateKey > endDateKey) {
    return [];
  }

  const keys: CivilDateKey[] = [];
  let cursor = startDateKey;

  while (cursor <= endDateKey) {
    keys.push(cursor);
    cursor = addCivilDateKeyDays(cursor, 1);
  }

  return keys;
}

/**
 * Format a date as a UTC date key in the format "yyyy-MM-dd".
 * @param date - The date to format
 * @returns The formatted date key
 */
export function formatUTCDateKey(date: DateInput): string {
  const value = toDate(date);
  if (!value) {
    throw new Error("Invalid date provided to formatUTCDateKey");
  }

  const dateKey = toUTCDateKey(value.toISOString().slice(0, 10));
  if (!dateKey) {
    throw new Error("Failed to produce a valid UTC date key");
  }

  return dateKey;
}

/**
 * Get the start of the UTC day for a given date.
 * @param date - The date to normalize
 * @returns Date at UTC midnight
 */
export function startOfUTCDay(date: DateInput): Date {
  const value = toDate(date);
  if (!value) {
    throw new Error("Invalid date provided to startOfUTCDay");
  }

  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/**
 * Add days in UTC (keeps date at UTC midnight).
 * @param date - The base date
 * @param days - Number of days to add (can be negative)
 * @returns Date at UTC midnight
 */
export function addUTCDays(date: DateInput, days: number): Date {
  const value = toDate(date);
  if (!value) {
    throw new Error("Invalid date provided to addUTCDays");
  }

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + days,
    ),
  );
}

/**
 * Format a date as a local date key in the format "yyyy-MM-dd".
 * Uses local date components to avoid timezone shifts in the UI.
 */
export function formatLocalDateKey(date: DateInput): string {
  const value = toDate(date);
  if (!value) {
    throw new Error("Invalid date provided to formatLocalDateKey");
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD date key into a UTC Date.
 * Returns Invalid Date for malformed inputs.
 * @param dateKey - The date key to parse
 * @returns Date at UTC midnight for the key
 */
export function parseUTCDateKey(dateKey: string): Date {
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
 * Parse a YYYY-MM-DD date key into a local Date (midnight).
 * Returns Invalid Date for malformed inputs.
 */
export function parseLocalDateKey(dateKey: string): Date {
  const trimmed = dateKey.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) {
    return new Date(NaN);
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  const value = new Date(year, month - 1, day);

  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day
  ) {
    return new Date(NaN);
  }

  return value;
}

/**
 * LocalDate: A timezone-agnostic date representation.
 * Uses year, month, day components instead of timestamps to avoid timezone issues.
 * LocalDate is locale-agnostic; localization happens when formatting for display.
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
