/**
 * Number Formatting Utilities
 *
 * A comprehensive set of functions for formatting numbers, currencies, and percentages
 * in a consistent way across the application. Numbers and strings are supported.
 *
 * All functions accept an options object with `locale` for consistent server/client rendering.
 * - Server Components: pass locale from `await getRequestLocale()`
 * - Client Components: pass locale from `useLocale()` hook
 *
 * @example
 * // Basic number formatting
 * formatNumber(1234.5678);                          // "1,235" (browser default locale)
 * formatNumber(1234.5678, { locale });              // "1,235" (explicit locale)
 * formatNumber(1234.5678, { locale, decimals: 2 }); // "1,234.57"
 *
 * @example
 * // Currency formatting (automatic decimal places)
 * formatCurrency(1234.56, "USD", { locale });  // "USD 1,234.56"
 * formatCurrency(1234.56, "JPY", { locale });  // "JPY 1,235"
 *
 * @example
 * // Currency with symbols
 * formatCurrency(1234.56, "USD", { locale, display: "symbol" }); // "$1,234.56"
 *
 * @example
 * // Percentage formatting
 * formatPercentage(0.1234, { locale });              // "12.34%"
 * formatPercentage(0.1234, { locale, decimals: 1 }); // "12.3%"
 *
 * @example
 * // Compact formatting for large numbers
 * formatCompactNumber(1234567, { locale });           // "1.2M"
 * formatCompactCurrency(1234567, "USD", { locale });  // "USD 1.2M"
 */

/**
 * Options for number formatting
 */
type FormatNumberOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Shorthand for setting both min and max fraction digits
   */
  decimals?: number;
  /**
   * Minimum number of decimal places
   */
  minimumFractionDigits?: number;
  /**
   * Maximum number of decimal places
   */
  maximumFractionDigits?: number;
  /**
   * Whether to use grouping separators
   * @default true
   */
  useGrouping?: boolean;
};

/**
 * Options for currency formatting
 */
type FormatCurrencyOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * How to display the currency
   * - 'code': Shows the ISO currency code (e.g., "1,234.56 USD")
   * - 'symbol': Shows the currency symbol (e.g., "$1,234.56")
   * @default 'code'
   */
  display?: "code" | "symbol";
};

/**
 * Options for percentage formatting
 */
type FormatPercentageOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
  /**
   * Number of decimal places
   * @default 2
   */
  decimals?: number;
};

/**
 * Options for compact number formatting
 */
type FormatCompactOptions = {
  /**
   * Locale for formatting (e.g., "en-US", "de-DE")
   */
  locale?: string;
};

/**
 * Default options for number formatting
 */
const defaultNumberOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
};

/**
 * Formats a number according to the specified options
 * @param value The number or string to format
 * @param options Formatting options including locale, decimals, and other settings
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string,
  options?: FormatNumberOptions,
): string {
  // Handle string input
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const { locale, decimals, ...restOptions } = options ?? {};

  // If decimals is provided, use it for both min and max
  const decimalOptions =
    decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {};

  const opts = { ...defaultNumberOptions, ...decimalOptions, ...restOptions };

  const formatter = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: opts.minimumFractionDigits,
    maximumFractionDigits: opts.maximumFractionDigits,
    useGrouping: opts.useGrouping,
  });

  return formatter.format(num);
}

/**
 * Formats a monetary value with the specified currency
 * @param value The monetary value to format
 * @param currency The ISO 4217 currency code
 * @param options Formatting options including locale and display style
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string,
  currency: string,
  options?: FormatCurrencyOptions,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const { locale, display = "code" } = options ?? {};

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: display === "symbol" ? "symbol" : "code",
  });

  return formatter.format(num);
}

/**
 * Formats a percentage value
 * @param value The decimal value to format as percentage
 * @param options Formatting options including locale and decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | string,
  options?: FormatPercentageOptions,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const { locale, decimals = 2 } = options ?? {};

  const formatter = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(num);
}

/**
 * Formats a large number in a human-readable format
 * @param value The number to format
 * @param options Formatting options including locale
 * @returns Formatted string with K, M, B suffix
 */
export function formatCompactNumber(
  value: number | string,
  options?: FormatCompactOptions,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const { locale } = options ?? {};

  const formatter = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return formatter.format(num);
}

/**
 * Formats a monetary value in compact notation with currency code
 * @param value The monetary value to format
 * @param currency The ISO 4217 currency code
 * @param options Formatting options including locale
 * @returns Formatted compact currency string (e.g., "1.2M USD")
 */
export function formatCompactCurrency(
  value: number | string,
  currency: string,
  options?: FormatCompactOptions,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const { locale } = options ?? {};

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return formatter.format(num);
}
