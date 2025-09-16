import { format } from "date-fns";

/**
 * Convert amount between currencies using USD as base currency
 * @param amount - Amount to convert
 * @param sourceCurrency - Source currency code
 * @param targetCurrency - Target currency code
 * @param exchangeRatesMap - Map of exchange rates ("CURRENCY|DATE" -> rate)
 * @param date - Date for exchange rate lookup
 * @returns Converted amount or original amount if conversion fails
 */
export function convertCurrency(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  exchangeRatesMap: Map<string, number>,
  date: Date | string,
): number {
  if (!Number.isFinite(amount) || amount === 0) return amount;

  // Same currency, no conversion needed
  if (sourceCurrency === targetCurrency) return amount;

  const dateKey = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
  const toUsdKey = `${sourceCurrency}|${dateKey}`;
  const fromUsdKey = `${targetCurrency}|${dateKey}`;

  const toUsdRate = exchangeRatesMap.get(toUsdKey);
  const fromUsdRate = exchangeRatesMap.get(fromUsdKey);

  if (!toUsdRate || !fromUsdRate) {
    console.warn(
      `Missing exchange rates for ${sourceCurrency} or ${targetCurrency} on ${dateKey}`,
    );
    return amount; // Fallback to original amount
  }

  // Convert: source -> USD -> target
  return (amount / toUsdRate) * fromUsdRate;
}
