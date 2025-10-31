import type { TransformedPosition } from "@/types/global.types";

/**
 * Interface for a pluggable market data handler.
 * Each handler is fully self-contained and manages:
 * - Extension table data fetching (if applicable)
 * - Market data fetching for its source type
 * - Key generation for price lookups
 */
export type MarketDataPosition = Pick<TransformedPosition, "id" | "currency"> &
  Partial<Pick<TransformedPosition, "symbol_id" | "domain_id">>;

export interface MarketDataHandler {
  /**
   * Position source that this handler supports (e.g., 'symbol', 'domain').
   */
  source: string;

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
   * Fetch market data for all applicable positions at a range of dates.
   * Returns a map where keys match the format from `getKey()`.
   */
  fetchForPositionsRange?(
    positions: MarketDataPosition[],
    dates: Date[],
    options?: { upsert?: boolean; eligibleDates?: Map<string, Set<string>> },
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
