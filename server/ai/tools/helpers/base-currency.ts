"use server";

import { fetchCurrencies } from "@/server/currencies/fetch";

export async function normalizeAIBaseCurrency(
  baseCurrency: string | null,
): Promise<string | null> {
  const normalized = baseCurrency?.trim().toUpperCase() || null;
  if (!normalized) return null;

  const currencies = await fetchCurrencies();
  const isSupported = currencies.some(
    (currency) => currency.alphabetic_code === normalized,
  );

  if (!isSupported) {
    throw new Error(
      `Unsupported baseCurrency "${normalized}". Set baseCurrency to null to use the profile currency.`,
    );
  }

  return normalized;
}
