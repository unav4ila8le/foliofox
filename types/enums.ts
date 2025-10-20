// Centralized, hardcoded enums for the app (positions-first architecture)

// Portfolio record types
export const PORTFOLIO_RECORD_TYPES = ["buy", "sell", "update"] as const;

// Position types (assets now; liabilities reserved for future)
export const POSITION_TYPES = ["asset", "liability"] as const;

// Position source types (sources hub)
export const POSITION_SOURCE_TYPES = ["symbol", "domain"] as const;
