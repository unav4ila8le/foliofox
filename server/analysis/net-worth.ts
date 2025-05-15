"use server";

import { fetchHoldings } from "@/server/holdings/fetch";

// Calculate total net worth
export async function calculateNetWorth() {
  const holdings = await fetchHoldings();

  // Sum up all holdings
  const netWorth = holdings.reduce(
    (total, holding) =>
      total + holding.current_quantity * holding.current_value,
    0,
  );

  return netWorth;
}
