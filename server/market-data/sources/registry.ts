import { symbolHandler } from "./symbol-handler";
import { domainHandler } from "./domain-handler";

import type { MarketDataHandler } from "./types";

// Registry of all market data handlers
export const MARKET_DATA_HANDLERS: MarketDataHandler[] = [
  symbolHandler,
  domainHandler,
];
