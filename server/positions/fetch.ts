"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchMarketData } from "@/server/market-data/fetch";
import { MARKET_DATA_HANDLERS } from "@/server/market-data/sources/registry";

import type { MarketDataPosition } from "@/server/market-data/sources/types";
import type {
  Position,
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

interface FetchPositionsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
  positionId?: string;
  /** Filter by position type */
  positionType?: "asset" | "liability";
  /**
   * As-of valuation date. When provided, builds current quantity/unit value
   * from position_snapshots at/before the date; otherwise uses latest.
   */
  asOfDate?: Date | null;
  /** Return grouped value history per position (position_snapshots). */
  includeSnapshots?: boolean;
}

/**
 * Fetch positions with optional archived filter and as-of valuation.
 * Returns UI-ready TransformedPosition[] mirroring the legacy API shape.
 */
export async function fetchPositions(
  options: FetchPositionsOptions & { includeSnapshots: true },
): Promise<{
  positions: TransformedPosition[];
  snapshots: Map<string, PositionSnapshot[]>;
}>;

export async function fetchPositions(
  options?: FetchPositionsOptions,
): Promise<TransformedPosition[]>;

export async function fetchPositions(options: FetchPositionsOptions = {}) {
  const {
    positionId,
    includeArchived = false,
    onlyArchived = false,
    positionType = "asset",
    asOfDate = null,
    includeSnapshots = false,
  } = options;

  const { supabase, user } = await getCurrentUser();

  // Load base rows with category and flattened source identifiers
  const baseQuery = supabase
    .from("positions")
    .select(
      `
      *,
      position_categories!inner (
        name,
        position_type,
        display_order
      ),
      position_sources_flat (
        id,
        type,
        symbol_id,
        domain_id
      )
    `,
    )
    .eq("user_id", user.id);

  // If a positionId is provided, filter for that specific position
  if (positionId) baseQuery.eq("id", positionId);

  // Optional type filter
  if (positionType) baseQuery.eq("type", positionType);

  // Handle archived positions filtering
  if (onlyArchived) baseQuery.not("archived_at", "is", null);
  else if (!includeArchived) baseQuery.is("archived_at", null);

  // Run the query and order by category display order
  const { data: positions, error } = await baseQuery.order(
    "position_categories(display_order)",
    { ascending: true },
  );

  if (error) throw new Error(error.message);

  if (positionId && (!positions || positions.length === 0)) {
    throw new Error("Position not found");
  }

  if (!positions?.length) return [];

  const positionIds = positions.map((position) => position.id);

  // Build snapshot query for as-of valuation or latest
  let snapshotsQuery = supabase
    .from("position_snapshots")
    .select("*")
    .in("position_id", positionIds)
    .eq("user_id", user.id)
    .order("position_id")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (asOfDate) {
    snapshotsQuery = snapshotsQuery.lte("date", format(asOfDate, "yyyy-MM-dd"));
  }

  const { data: snapshots, error: snapshotsError } = await snapshotsQuery;
  if (snapshotsError) {
    throw new Error(`Failed to fetch snapshots: ${snapshotsError.message}`);
  }

  // Keep the latest snapshot per position (or latest <= asOfDate)
  const latestSnapshotByPositionId = new Map<string, PositionSnapshot>();
  snapshots?.forEach((snapshotRow) => {
    if (!latestSnapshotByPositionId.has(snapshotRow.position_id)) {
      latestSnapshotByPositionId.set(snapshotRow.position_id, snapshotRow);
    }
  });

  // Fetch market data prices when asOfDate is provided
  let priceMap = new Map<string, number>();
  if (asOfDate !== null) {
    const activePositionIds = new Set(latestSnapshotByPositionId.keys());
    const marketPositions: MarketDataPosition[] = positions
      .filter((p) => activePositionIds.has(p.id))
      .map((p) => ({
        currency: p.currency,
        symbol_id: p.position_sources_flat?.symbol_id ?? null,
        domain_id: p.position_sources_flat?.domain_id ?? null,
      }));

    priceMap = await fetchMarketData(marketPositions, asOfDate);
  }

  // Transform into UI-friendly shape
  const transformed: TransformedPosition[] = positions.map((position) => {
    const latestSnapshot = latestSnapshotByPositionId.get(position.id);
    const current_quantity = latestSnapshot?.quantity ?? 0;

    // Use market price if available, otherwise fallback to snapshot unit value
    let current_unit_value = latestSnapshot?.unit_value ?? 0;
    if (asOfDate !== null && position.position_sources_flat?.type) {
      const handler = MARKET_DATA_HANDLERS.find(
        (h) => h.source === position.position_sources_flat?.type,
      );
      if (handler) {
        const key = handler.getKey(
          {
            currency: position.currency,
            symbol_id: position.position_sources_flat?.symbol_id ?? null,
            domain_id: position.position_sources_flat?.domain_id ?? null,
          },
          asOfDate,
        );
        current_unit_value = priceMap.get(key ?? "") ?? current_unit_value;
      }
    }

    return {
      ...(position as Position),
      is_archived: position.archived_at !== null,
      category_name: position.position_categories?.name,
      symbol_id: position.position_sources_flat?.symbol_id ?? null,
      domain_id: position.position_sources_flat?.domain_id ?? null,
      current_quantity,
      current_unit_value,
      total_value: current_quantity * current_unit_value,
    };
  });

  if (!includeSnapshots) return transformed;

  // Group snapshots by position for callers that need histories
  const groupedSnapshots = new Map<string, PositionSnapshot[]>();
  snapshots?.forEach((snapshotRow) => {
    const existing = groupedSnapshots.get(snapshotRow.position_id) || [];
    existing.push(snapshotRow as unknown as PositionSnapshot);
    groupedSnapshots.set(snapshotRow.position_id, existing);
  });

  return { positions: transformed, snapshots: groupedSnapshots };
}
