"use server";

import { fetchHoldings } from "@/server/holdings/fetch";
import { fetchExchangeRate } from "@/server/exchange-rates/fetch";

// Calculate total net worth in USD
export async function calculateNetWorth() {
  const holdings = await fetchHoldings();

  // Convert each holding to USD
  const holdingsInUSD = await Promise.all(
    holdings.map(async (holding) => {
      const value = holding.current_quantity * holding.current_value;
      const rate = await fetchExchangeRate(holding.currency);
      return value * rate;
    }),
  );

  // Sum all values
  const netWorth = holdingsInUSD.reduce((total, value) => total + value, 0);

  return netWorth;
}
