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
