"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";

import type {
  Position,
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

interface FetchPositionsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
  positionId?: string;
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

  // Transform into UI-friendly shape
  const transformed: TransformedPosition[] = positions.map((position) => {
    const latestSnapshot = latestSnapshotByPositionId.get(position.id);
    const current_quantity = latestSnapshot?.quantity ?? 0;
    const current_unit_value = latestSnapshot?.unit_value ?? 0;
    const total_value = current_quantity * current_unit_value;

    // Read identifiers from flattened view if available
    const positionWithJoins = position as Position & {
      position_sources_flat?: {
        symbol_id: string | null;
        domain_id: string | null;
      } | null;
      position_categories: { name: string };
    };

    return {
      ...(position as Position),
      is_archived: position.archived_at !== null,
      category_name: positionWithJoins.position_categories?.name,
      symbol_id: positionWithJoins.position_sources_flat?.symbol_id ?? null,
      domain_id: positionWithJoins.position_sources_flat?.domain_id ?? null,
      current_quantity,
      current_unit_value,
      total_value,
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
