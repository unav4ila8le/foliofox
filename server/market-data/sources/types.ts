import type { TransformedHolding } from "@/types/global.types";

/**
 * Interface for a pluggable market data handler.
 * Each handler owns:
 * - which holdings it applies to (by source)
 * - how to collect request payloads
 * - how to fetch data in bulk for those payloads
 * - how to compute the lookup key used by callers for a given holding/date
 */
export interface MarketDataHandler<RequestPayload> {
  /**
   * Holding source that this handler supports (e.g., 'symbol', 'domain').
   */
  source: string;

  /**
   * Build a list of request payloads for supported holdings at a date.
   * Should ignore holdings that do not have enough information (e.g., no id).
   */
  collectRequests(holdings: TransformedHolding[], date: Date): RequestPayload[];

  /**
   * Fetch data for the provided request payloads in bulk.
   * Should return a map keyed the same way as `getKey` below.
   */
  fetchData(
    requests: RequestPayload[],
    options?: { upsert?: boolean },
  ): Promise<Map<string, number>>;

  /**
   * The key used by callers to look up the value in the map returned by fetchData.
   * Return null if the holding does not have enough information for a key.
   */
  getKey(holding: TransformedHolding, date: Date): string | null;
}

// Concrete request payloads per current sources
export type SymbolRequest = { symbolId: string; date: Date };
export type DomainRequest = { domain: string; date: Date };

// Specialized handler interfaces with discriminated source
export interface SymbolMarketDataHandler
  extends MarketDataHandler<SymbolRequest> {
  source: "symbol";
}

export interface DomainMarketDataHandler
  extends MarketDataHandler<DomainRequest> {
  source: "domain";
}

export type RegisteredMarketDataHandler =
  | SymbolMarketDataHandler
  | DomainMarketDataHandler;
