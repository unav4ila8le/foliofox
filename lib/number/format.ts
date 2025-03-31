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

  const formatter = new Intl.NumberFormat("en-US", {
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
 * @returns Formatted currency string with proper currency symbol
 */
export function formatCurrency(
  value: number | string,
  currency: string,
): string {
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

  const formatter = new Intl.NumberFormat("en-US", {
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
  return `${compactValue} ${currency}`;
}
