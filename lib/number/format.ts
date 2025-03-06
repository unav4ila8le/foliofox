type FormatNumberOptions = {
  /**
   * The currency code to use (ISO 4217)
   * @example "EUR", "USD", "GBP"
   */
  currency?: string;
  /**
   * Minimum number of decimal places
   * @default 2 for currency, 0 for regular numbers
   */
  minimumFractionDigits?: number;
  /**
   * Maximum number of decimal places
   * @default 2 for currency, 0 for regular numbers
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
};

/**
 * Formats a number according to the specified options
 * @param value The number to format
 * @param options Formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  options?: FormatNumberOptions,
): string {
  const opts = { ...defaultOptions, ...options };

  const formatter = new Intl.NumberFormat("en-US", {
    style: opts.currency ? "decimal" : "decimal",
    minimumFractionDigits: opts.minimumFractionDigits,
    maximumFractionDigits: opts.maximumFractionDigits,
    useGrouping: opts.useGrouping,
  });

  const formattedValue = formatter.format(value);
  return opts.currency ? `${formattedValue} ${opts.currency}` : formattedValue;
}

/**
 * Formats a monetary value with the specified currency
 * @param value The monetary value to format
 * @param currency The ISO 4217 currency code
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string): string {
  return formatNumber(value, { currency });
}

/**
 * Formats a percentage value
 * @param value The decimal value to format as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${formatNumber(value * 100, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Formats a large number in a human-readable format
 * @param value The number to format
 * @returns Formatted string with K, M, B suffix
 */
export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return formatter.format(value);
}

/**
 * Formats a monetary value in compact notation with currency code
 * @param value The monetary value to format
 * @param currency The ISO 4217 currency code
 * @returns Formatted compact currency string (e.g., "$1.2M USD")
 */
export function formatCompactCurrency(value: number, currency: string): string {
  const compactValue = formatCompactNumber(value);
  return `${compactValue} ${currency}`;
}
