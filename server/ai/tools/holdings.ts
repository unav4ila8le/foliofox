"use server";

import { fetchHoldings } from "@/server/holdings/fetch";

interface GetHoldingsParams {
  holdingIds?: string[];
  date?: string; // YYYY-MM-DD (optional). Defaults to today.
}

/**
 * Return raw holdings in original currencies.
 * - Includes archived holdings by default (AI decides relevance)
 * - Uses market quotes as-of the provided date (or today) for symbol holdings
 * - Non-symbol holdings use latest record unit_value
 */
export async function getHoldings(params: GetHoldingsParams = {}) {
  const quoteDate = params.date ? new Date(params.date) : new Date();

  const all = await fetchHoldings({
    includeArchived: true,
    quoteDate, // ensures symbol holdings use up-to-date market prices
  });

  const ids = params.holdingIds ? new Set(params.holdingIds) : undefined;
  const filtered = ids ? all.filter((h) => ids.has(h.id)) : all;

  const items = filtered.map((h) => ({
    id: h.id as string,
    name: h.name as string,
    category_code: h.category_code as string,
    category: h.asset_type as string,
    symbol_id: (h.symbol_id as string | null) ?? null,
    currency: h.currency as string,
    description: (h.description as string | null) ?? null,
    is_archived: Boolean(h.is_archived),
    archived_at: (h.archived_at as string | null) ?? null,
    created_at: h.created_at as string,
    current_quantity: h.current_quantity as number,
    current_unit_value: h.current_unit_value as number,
    total_value: h.total_value as number,
  }));

  return {
    total: filtered.length,
    returned: items.length,
    holdingIds: params.holdingIds ?? null,
    date: quoteDate.toISOString().split("T")[0],
    items,
  };
}
