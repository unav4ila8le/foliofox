import type { MarketDataHandler, MarketDataPosition } from "./types";

export interface MarketDataResolution {
  handler: MarketDataHandler;
  key: string;
}

/**
 * Identify the handler/key responsible for a given position on a date.
 * Returns null when no handler accepts the position.
 */
export function resolveMarketDataKey(
  handlers: MarketDataHandler[],
  position: MarketDataPosition,
  date: Date,
): MarketDataResolution | null {
  if (!position.id) return null;

  for (const handler of handlers) {
    const key = handler.getKey(position, date);
    if (key) {
      return { handler, key };
    }
  }

  return null;
}

/**
 * Resolve handlers/keys for many positions at once.
 * Returns a map keyed by position.id.
 */
export function resolveMarketDataForPositions(
  handlers: MarketDataHandler[],
  positions: MarketDataPosition[],
  date: Date,
) {
  const resolutions = new Map<string, MarketDataResolution>();

  for (const position of positions) {
    const resolution = resolveMarketDataKey(handlers, position, date);
    if (resolution) {
      resolutions.set(position.id as string, resolution);
    }
  }

  return resolutions;
}
