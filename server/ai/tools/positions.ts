"use server";

import { fetchPositions } from "@/server/positions/fetch";
import { resolveSymbolsBatch } from "@/server/symbols/resolver";

interface GetPositionsParams {
  positionIds: string[] | null;
  date: string | null; // YYYY-MM-DD (optional). Defaults to today.
}

/**
 * Return raw positions in original currencies.
 * - Includes archived positions by default (AI decides relevance)
 * - Values are as-of the provided date (or today) via latest snapshots/market-backed pricing
 */
export async function getPositions(params: GetPositionsParams) {
  const asOfDate = params.date ? new Date(params.date) : new Date();

  const all = await fetchPositions({
    includeArchived: true,
    asOfDate,
  });

  const ids = params.positionIds ? new Set(params.positionIds) : undefined;
  const filtered = ids ? all.filter((p) => ids.has(p.id)) : all;

  const symbolIdSet = new Set(
    filtered.map((p) => p.symbol_id).filter((id): id is string => Boolean(id)),
  );

  const symbolIdToTicker = new Map<string, string>();
  if (symbolIdSet.size) {
    const { byInput } = await resolveSymbolsBatch(Array.from(symbolIdSet), {
      provider: "yahoo",
      providerType: "ticker",
      onError: "warn",
    });

    byInput.forEach((resolution, symbolId) => {
      const ticker =
        resolution.displayTicker ?? resolution.providerAlias ?? null;
      if (ticker) {
        symbolIdToTicker.set(symbolId, ticker);
      }
    });
  }

  const items = filtered.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    category_id: p.category_id as string,
    category: p.category_name as string,
    symbol: p.symbol_id ? (symbolIdToTicker.get(p.symbol_id) ?? null) : null,
    currency: p.currency as string,
    description: p.description as string | null,
    is_archived: Boolean(p.is_archived),
    archived_at: p.archived_at as string | null,
    created_at: p.created_at as string,
    current_quantity: p.current_quantity as number,
    current_unit_value: p.current_unit_value as number,
    total_value: p.total_value as number,
  }));

  return {
    total: filtered.length,
    returned: items.length,
    positionIds: params.positionIds,
    date: asOfDate.toISOString().split("T")[0],
    items,
  };
}
