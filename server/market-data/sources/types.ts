import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransformedHolding } from "@/types/global.types";

/**
 * Interface for a pluggable market data handler.
 * Each handler is fully self-contained and manages:
 * - Extension table data fetching (if applicable)
 * - Market data fetching for its source type
 * - Key generation for price lookups
 */
export interface MarketDataHandler {
  /**
   * Holding source that this handler supports (e.g., 'symbol', 'domain').
   */
  source: string;

  /**
   * Fetch extension table data for holdings of this source type.
   * Returns a map of holding_id -> source-specific ID (e.g., symbol_id, domain_id).
   *
   * @param holdingIds - IDs of holdings to fetch extensions for
   * @param supabase - Supabase client for database access
   * @returns Map of holding_id to source-specific ID
   */
  fetchExtensions?(
    holdingIds: string[],
    supabase: SupabaseClient,
  ): Promise<Map<string, string>>;

  /**
   * Fetch market data for all applicable holdings at a date.
   * Returns a map where keys match the format from `getKey()`.
   */
  fetchForHoldings(
    holdings: TransformedHolding[],
    date: Date,
    options?: { upsert?: boolean },
  ): Promise<Map<string, number>>;

  /**
   * The key used by callers to look up the value in the map returned by fetchForHoldings.
   * Return null if the holding does not have enough information for a key.
   */
  getKey(holding: TransformedHolding, date: Date): string | null;
}

// Concrete request payloads (kept for internal handler use)
export type SymbolRequest = { symbolId: string; date: Date };
export type DomainRequest = { domain: string; date: Date };
