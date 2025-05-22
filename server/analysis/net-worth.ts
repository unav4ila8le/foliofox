"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRate } from "@/server/exchange-rates/fetch";

// Calculate total net worth in specified target currency
export async function calculateNetWorth(targetCurrency: string) {
  const holdings = await fetchHoldings();

  // Convert each holding to USD
  const holdingsInUSD = await Promise.all(
    holdings.map(async (holding) => {
      const value = holding.current_quantity * holding.current_value;
      const rate = await fetchExchangeRate(holding.currency);
      return value / rate;
    }),
  );

  // Sum all values in USD
  const netWorthInUSD = holdingsInUSD.reduce(
    (total, value) => total + value,
    0,
  );

  // Convert from USD to target currency
  const rate = await fetchExchangeRate(targetCurrency);
  const netWorth = netWorthInUSD * rate;

  return netWorth;
}
