type DateInput = Date | string | number;

/**
 * Date Formatting Utilities
 *
 * A focused set of helpers for formatting dates in a consistent, locale-aware way.
 * Use these for display. For storage and API keys, prefer stable formats like UTC date keys.
 *
 * All display helpers accept an options object with `locale` for consistent server/client rendering.
 * - Server Components: pass locale from `await getRequestLocale()`
 * - Client Components: pass locale from `useLocale()` hook
 *
 * @example
 * // Date formatting
 * formatDate(new Date(), { locale });                 // "Mar 3, 2026"
 * formatDateTime(new Date(), { locale });             // "Mar 3, 2026, 9:41 AM"
 * formatMonthYear(new Date(), { locale });            // "Mar 2026"
 * formatMonthDay(new Date(), { locale });             // "Mar 3"
 * formatLocalDate({ y: 2026, m: 3, d: 3 }, { locale }); // "Mar 3, 2026"
 */

/**
 * Options for date formatting
 */
type FormatDateOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Date style (default: "medium")
   */
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  /**
   * Time zone override (e.g., "UTC")
   */
  timeZone?: string;
};

/**
 * Options for date-time formatting
 */
type FormatDateTimeOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Date style (default: "medium")
   */
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  /**
   * Time style (default: "short")
   */
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
  /**
   * Time zone override (e.g., "UTC")
   */
  timeZone?: string;
};

/**
 * Options for month-year formatting
 */
type FormatMonthYearOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Month style (default: "short")
   */
  month?: Intl.DateTimeFormatOptions["month"];
  /**
   * Year style (default: "numeric")
   */
  year?: Intl.DateTimeFormatOptions["year"];
  /**
   * Time zone override (e.g., "UTC")
   */
  timeZone?: string;
};

/**
 * Options for month-day formatting
 */
type FormatMonthDayOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Month style (default: "short")
   */
  month?: Intl.DateTimeFormatOptions["month"];
  /**
   * Day style (default: "numeric")
   */
  day?: Intl.DateTimeFormatOptions["day"];
  /**
   * Time zone override (e.g., "UTC")
   */
  timeZone?: string;
};

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Format a date using Intl.DateTimeFormat with locale support.
 * @param value - The date to format
 * @param options - Formatting options including locale and date style
 * @returns The formatted date string
 */
export function formatDate(
  value: DateInput,
  options?: FormatDateOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const { locale, dateStyle = "medium", timeZone } = options ?? {};

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeZone,
  });

  return formatter.format(date);
}

/**
 * Format a date and time using Intl.DateTimeFormat with locale support.
 * @param value - The date to format
 * @param options - Formatting options including locale, date style, and time style
 * @returns The formatted date-time string
 */
export function formatDateTime(
  value: DateInput,
  options?: FormatDateTimeOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const {
    locale,
    dateStyle = "medium",
    timeStyle = "short",
    timeZone,
  } = options ?? {};

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
    timeZone,
  });

  return formatter.format(date);
}

/**
 * Format a date as month and year using Intl.DateTimeFormat with locale support.
 * @param value - The date to format
 * @param options - Formatting options including locale and month/year styles
 * @returns The formatted month-year string
 */
export function formatMonthYear(
  value: DateInput,
  options?: FormatMonthYearOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const { locale, month = "short", year = "numeric", timeZone } = options ?? {};

  const formatter = new Intl.DateTimeFormat(locale, {
    month,
    year,
    timeZone,
  });

  return formatter.format(date);
}

/**
 * Format a date as month and day using Intl.DateTimeFormat with locale support.
 * @param value - The date to format
 * @param options - Formatting options including locale and month/day styles
 * @returns The formatted month-day string
 */
export function formatMonthDay(
  value: DateInput,
  options?: FormatMonthDayOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  const { locale, month = "short", day = "numeric", timeZone } = options ?? {};

  const formatter = new Intl.DateTimeFormat(locale, {
    month,
    day,
    timeZone,
  });

  return formatter.format(date);
}

/**
 * Format a LocalDate using Intl.DateTimeFormat with locale support.
 * @param value - The LocalDate to format
 * @param options - Formatting options including locale and date style
 * @returns The formatted date string
 */
export function formatLocalDate(
  value: { y: number; m: number; d: number },
  options?: FormatDateOptions,
): string {
  const date = new Date(value.y, value.m - 1, value.d);
  return formatDate(date, options);
}
