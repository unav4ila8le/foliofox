/**
 * Number Formatting Utilities
 *
 * A comprehensive set of functions for formatting numbers, currencies, and percentages
 * in a consistent way across the application. Numbers and strings are supported.
 *
 * @example
 * // Basic number formatting
 * formatNumber(1234.5678);        // "1,235"
 * formatNumber(1234.5678, 2);     // "1,234.57"
 * formatNumber(1234.5678, 0);     // "1,235"
 *
 * @example
 * // Currency formatting (automatic decimal places)
 * formatCurrency(1234.56, "USD");  // "USD 1,234.56"  (2 decimals)
 * formatCurrency(1234.56, "JPY");  // "JPY 1,235"     (0 decimals)
 * formatCurrency(1234.56, "BHD");  // "BHD 1,234.560" (3 decimals)
 *
 * @example
 * // Currency with symbols
 * formatCurrency(1234.56, "USD", { display: "symbol" }); // "$1,234.56"
 * formatCurrency(1234.56, "JPY", { display: "symbol" }); // "¥1,235"
 *
 * @example
 * // Percentage formatting
 * formatPercentage(0.1234);     // "12.34%"
 * formatPercentage(0.1234, 1);  // "12.3%"
 *
 * @example
 * // Compact formatting for large numbers
 * formatCompactNumber(1234567);           // "1.2M"
 * formatCompactCurrency(1234567, "USD");  // "1.2M USD"
 *
 * @example
 * // String input handling
 * formatNumber("1,234.56");         // "1,235"
 * formatCurrency("invalid", "USD"); // "" (empty string for invalid input)
 */

type FormatNumberOptions = {
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
type CurrencyFormatOptions = {
  /**
   * How to display the currency
   * - 'code': Shows the ISO currency code (e.g., "1,234.56 USD")
   * - 'symbol': Shows the currency symbol (e.g., "$1,234.56")
   * @default 'code'
   */
  display?: "code" | "symbol";
};

/**
 * Default options for number formatting
 */
const defaultOptions: FormatNumberOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
};

/**
 * Formats a number according to the specified options
 * @param value The number or string to format
 * @param decimals Shorthand for setting both min and max fraction digits
 * @param options Additional formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string,
  decimals?: number,
  options?: FormatNumberOptions,
): string {
  // Handle string input
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  // If decimals is provided, use it for both min and max
  const decimalOptions =
    decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {};

  const opts = { ...defaultOptions, ...decimalOptions, ...options };

  const formatter = new Intl.NumberFormat(undefined, {
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
 * @param options Currency formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string,
  currency: string,
  options: CurrencyFormatOptions = { display: "code" },
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  if (options.display === "symbol") {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
    return formatter.format(num);
  }

  // For code display, we'll also use Intl.NumberFormat but with code display
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  });
  return formatter.format(num);
}

/**
 * Formats a percentage value
 * @param value The decimal value to format as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | string,
  decimals: number = 2,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  return `${formatNumber(num * 100, decimals)}%`;
}

/**
 * Formats a large number in a human-readable format
 * @param value The number to format
 * @returns Formatted string with K, M, B suffix
 */
export function formatCompactNumber(value: number | string): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const formatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return formatter.format(num);
}

/**
 * Formats a monetary value in compact notation with currency code
 * @param value The monetary value to format
 * @param currency The ISO 4217 currency code
 * @returns Formatted compact currency string (e.g., "1.2M USD")
 */
export function formatCompactCurrency(
  value: number | string,
  currency: string,
): string {
  const compactValue = formatCompactNumber(value);
  return `${currency} ${compactValue}`;
}
