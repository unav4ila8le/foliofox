import { symbolHandler } from "./symbol-handler";
import { domainHandler } from "./domain-handler";

import type { RegisteredMarketDataHandler } from "./types";

// Erase handler generics at the registry boundary for simpler consumption
export const MARKET_DATA_HANDLERS: RegisteredMarketDataHandler[] = [
  symbolHandler,
  domainHandler,
];
