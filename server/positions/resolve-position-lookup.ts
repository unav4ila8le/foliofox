"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { resolveSymbolInput } from "@/server/symbols/resolve";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolvePositionLookupParams {
  lookup: string;
  includeArchived?: boolean;
}

export interface ResolvedPositionLookup {
  positionId: string;
  positionName: string;
  symbolId: string | null;
  matchedBy: "position_id" | "symbol_alias";
}

export async function resolvePositionLookup(
  params: ResolvePositionLookupParams,
): Promise<ResolvedPositionLookup> {
  const { lookup, includeArchived = true } = params;
  const trimmed = lookup?.trim();

  if (!trimmed) {
    throw new Error("Position lookup value is required.");
  }

  const { supabase, user } = await getCurrentUser();

  // 1. Try direct position UUID match first
  if (UUID_PATTERN.test(trimmed)) {
    let query = supabase
      .from("positions")
      .select("id, name, symbol_id, archived_at")
      .eq("user_id", user.id)
      .eq("id", trimmed);

    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data: position, error } = await query.maybeSingle();

    if (!error && position) {
      return {
        positionId: position.id,
        positionName: position.name,
        symbolId: position.symbol_id,
        matchedBy: "position_id",
      };
    }
    // If UUID didn't match a position, fall through to symbol resolution
  }

  // 2. Resolve via symbol lookup
  const resolved = await resolveSymbolInput(trimmed);

  if (!resolved?.symbol?.id) {
    throw new Error(
      `Unable to resolve "${trimmed}" to a known symbol. ` +
        `If referring to a specific position, use its UUID from getPortfolioOverview.`,
    );
  }

  // 3. Find positions for this symbol
  let positionsQuery = supabase
    .from("positions")
    .select("id, name, symbol_id, archived_at")
    .eq("user_id", user.id)
    .eq("symbol_id", resolved.symbol.id);

  if (!includeArchived) {
    positionsQuery = positionsQuery.is("archived_at", null);
  }

  const { data: positions, error: positionsError } = await positionsQuery;

  if (positionsError) {
    throw new Error(`Failed to fetch positions: ${positionsError.message}`);
  }

  if (!positions || positions.length === 0) {
    const ticker =
      resolved.primaryAlias?.value ?? resolved.symbol.ticker ?? trimmed;
    throw new Error(
      `No positions found for symbol "${ticker}". ` +
        `The user may not hold this asset.`,
    );
  }

  if (positions.length > 1) {
    const ticker =
      resolved.primaryAlias?.value ?? resolved.symbol.ticker ?? trimmed;
    const names = positions.map((p) => `"${p.name}"`).join(", ");
    throw new Error(
      `Multiple positions found for "${ticker}". ` +
        `Please specify which position by name: ${names}.`,
    );
  }

  return {
    positionId: positions[0].id,
    positionName: positions[0].name,
    symbolId: positions[0].symbol_id,
    matchedBy: "symbol_alias",
  };
}
