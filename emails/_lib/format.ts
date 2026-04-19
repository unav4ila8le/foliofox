import { formatCurrency } from "@/lib/number-format";

export function formatEmailCurrency(value: number, currency: string) {
  return formatCurrency(value, currency, {
    display: "symbol",
  });
}

export function formatSignedEmailCurrency(value: number, currency: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatEmailCurrency(Math.abs(value), currency)}`;
}

export function formatSignedPercentage(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${prefix}${Math.abs(value).toFixed(1)}%`;
}

/**
 * Render a position label for email body text.
 * Symbol is appended in parentheses when present (e.g. "NVIDIA (NVDA)").
 */
export function renderEmailAssetLabel(name: string, symbol: string | null) {
  return symbol ? `${name} (${symbol})` : name;
}
