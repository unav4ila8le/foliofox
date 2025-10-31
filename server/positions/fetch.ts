"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchMarketData } from "@/server/market-data/fetch";
import { resolveMarketDataForPositions } from "@/server/market-data/sources/resolver";

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
    positionType,
    asOfDate = null,
    includeSnapshots = false,
  } = options;

  const { supabase, user } = await getCurrentUser();

  // Load base rows with category
  const baseQuery = supabase
    .from("positions")
    .select(
      `
      *,
      position_categories!inner (
        name,
        position_type,
        display_order
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

  // Order results
  if (onlyArchived) {
    // Archived list: newest archived first
    baseQuery.order("archived_at", { ascending: false });
  } else {
    // Non-archived views: order by category display order
    baseQuery.order("position_categories(display_order)", { ascending: true });
  }

  // Run the query
  const { data: positions, error } = await baseQuery;

  if (error) throw new Error(error.message);

  if (!positions?.length) {
    if (!includeSnapshots) return [];
    return { positions: [], snapshots: new Map<string, PositionSnapshot[]>() };
  }

  if (positionId && (!positions || positions.length === 0)) {
    throw new Error("Position not found");
  }

  if (!positions?.length) return [];

  const positionIds = positions.map((position) => position.id);

  const marketDataPositionsAll: MarketDataPosition[] = positions.map(
    (position) => ({
      id: position.id,
      currency: position.currency,
      symbol_id: position.symbol_id ?? null,
      domain_id: position.domain_id ?? null,
    }),
  );

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

  const { MARKET_DATA_HANDLERS } = await import(
    "@/server/market-data/sources/registry"
  );

  const resolutionDate = asOfDate ?? new Date();
  const allResolutions = resolveMarketDataForPositions(
    MARKET_DATA_HANDLERS,
    marketDataPositionsAll,
    resolutionDate,
  );

  // Fetch market data prices when asOfDate is provided
  let priceMap = new Map<string, number>();
  if (asOfDate !== null) {
    const activePositionIds = new Set(latestSnapshotByPositionId.keys());
    const positionsForMarketData = marketDataPositionsAll.filter((position) =>
      activePositionIds.has(position.id),
    );

    const marketData = await fetchMarketData(
      positionsForMarketData,
      asOfDate as Date,
    );
    priceMap = marketData.prices;
  }

  // Transform into UI-friendly shape
  const transformed: TransformedPosition[] = positions.map((position) => {
    const latestSnapshot = latestSnapshotByPositionId.get(position.id);
    const current_quantity = latestSnapshot?.quantity ?? 0;

    // Use market price if available, otherwise fallback to snapshot unit value
    let current_unit_value = latestSnapshot?.unit_value ?? 0;
    if (asOfDate !== null) {
      const price = priceMap.get(position.id);
      if (price !== undefined) {
        current_unit_value = price;
      }
    }

    const has_market_data = allResolutions.has(position.id);

    return {
      ...(position as Position),
      is_archived: position.archived_at !== null,
      category_name: position.position_categories?.name,
      symbol_id: position.symbol_id ?? null,
      domain_id: position.domain_id ?? null,
      current_quantity,
      current_unit_value,
      total_value: current_quantity * current_unit_value,
      has_market_data,
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

/**
 * Fetch a single position by ID.
 * Throws if position not found.
 *
 * @param positionId - The ID of the position to fetch
 * @param options - Optional fetch options (same as fetchPositions)
 * @returns Single position or position with snapshots (based on includeSnapshots)
 */
export async function fetchSinglePosition(
  positionId: string,
  options: Omit<FetchPositionsOptions, "positionId"> & {
    includeSnapshots: true;
  },
): Promise<{
  position: TransformedPosition;
  snapshots: PositionSnapshot[];
}>;

export async function fetchSinglePosition(
  positionId: string,
  options?: Omit<FetchPositionsOptions, "positionId">,
): Promise<TransformedPosition>;

export async function fetchSinglePosition(
  positionId: string,
  options: Omit<FetchPositionsOptions, "positionId"> = {},
) {
  if (options.includeSnapshots) {
    const { positions, snapshots } = await fetchPositions({
      ...options,
      positionId,
      includeSnapshots: true,
    });

    if (!positions || positions.length === 0) {
      throw new Error(`Position not found: ${positionId}`);
    }

    return {
      position: positions[0],
      snapshots: snapshots.get(positions[0].id) || [],
    };
  }

  const positions = await fetchPositions({
    ...options,
    positionId,
  });

  if (!positions || positions.length === 0) {
    throw new Error(`Position not found: ${positionId}`);
  }

  return positions[0];
}
