"use server";

import { fetchProfile } from "@/server/profile/actions";
import { fetchPositions } from "@/server/positions/fetch";
import { resolvePositionLookup } from "@/server/positions/resolve-position-lookup";
import {
  fetchPositionTagAssignments,
  fetchPositionTags,
} from "@/server/position-tags/fetch";

import { resolveSymbolsBatch } from "@/server/symbols/resolve";
import { resolveTodayDateKey, toCivilDateKey } from "@/lib/date/date-utils";

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
  const { profile } = await fetchProfile();
  const requestedDateKey = params.date ? toCivilDateKey(params.date) : null;
  const asOfDateKey =
    requestedDateKey ?? resolveTodayDateKey(profile.time_zone);

  // Resolve lookups (ticker/ISIN/UUID) to actual position UUIDs
  let resolvedIds: Set<string> | undefined;
  if (params.positionIds && params.positionIds.length > 0) {
    const resolved = await Promise.all(
      params.positionIds.map((lookup) => resolvePositionLookup({ lookup })),
    );
    resolvedIds = new Set(resolved.map((r) => r.positionId));
  }

  const [all, tags, tagAssignments] = await Promise.all([
    fetchPositions({ includeArchived: true, asOfDateKey }),
    fetchPositionTags(),
    fetchPositionTagAssignments(),
  ]);

  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const tagNamesByPositionId = new Map<string, string[]>();
  for (const { position_id, tag_id } of tagAssignments) {
    const tagName = tagNameById.get(tag_id);
    if (!tagName) continue;
    const positionTagNames = tagNamesByPositionId.get(position_id) ?? [];
    positionTagNames.push(tagName);
    tagNamesByPositionId.set(position_id, positionTagNames);
  }

  const filtered = resolvedIds ? all.filter((p) => resolvedIds.has(p.id)) : all;

  const symbolIdSet = new Set(
    filtered.map((p) => p.symbol_id).filter((id): id is string => Boolean(id)),
  );

  const symbolIdToTicker = new Map<string, string>();
  if (symbolIdSet.size) {
    const { byInput } = await resolveSymbolsBatch(Array.from(symbolIdSet), {
      provider: "yahoo",
      providerType: "ticker",
      providerAliasMode: "display-fallback",
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
    category: p.display_category_name as string,
    display_category_id: p.display_category_id as string,
    symbol: p.symbol_id ? (symbolIdToTicker.get(p.symbol_id) ?? null) : null,
    currency: p.currency as string,
    capital_gains_tax_rate: p.capital_gains_tax_rate as number | null,
    description: p.description as string | null,
    tags: tagNamesByPositionId.get(p.id) ?? [],
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
    date: asOfDateKey,
    items,
  };
}
