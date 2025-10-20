import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransformedPosition } from "@/types/global.types";

/**
 * Interface for a pluggable market data handler.
 * Each handler is fully self-contained and manages:
 * - Extension table data fetching (if applicable)
 * - Market data fetching for its source type
 * - Key generation for price lookups
 */
export type MarketDataPosition = Pick<TransformedPosition, "currency"> &
  Partial<Pick<TransformedPosition, "symbol_id" | "domain_id">>;

export interface MarketDataHandler {
  /**
   * Position source that this handler supports (e.g., 'symbol', 'domain').
   */
  source: string;

  /**
   * Fetch extension table data for positions of this source type.
   * Returns a map of position_id -> source-specific ID (e.g., symbol_id, domain_id).
   *
   * @param positionIds - IDs of positions to fetch extensions for
   * @param supabase - Supabase client for database access
   * @returns Map of position_id to source-specific ID
   */
  fetchExtensions?(
    positionIds: string[],
    supabase: SupabaseClient,
  ): Promise<Map<string, string>>;

  /**
   * Fetch market data for all applicable positions at a date.
   * Returns a map where keys match the format from `getKey()`.
   */
  fetchForPositions(
    positions: MarketDataPosition[],
    date: Date,
    options?: { upsert?: boolean },
  ): Promise<Map<string, number>>;

  /**
   * The key used by callers to look up the value in the map returned by fetchForPositions.
   * Return null if the positions does not have enough information for a key.
   */
  getKey(position: MarketDataPosition, date: Date): string | null;
}

// Concrete request payloads (kept for internal handler use)
export type SymbolRequest = { symbolId: string; date: Date };
export type DomainRequest = { domain: string; date: Date };
