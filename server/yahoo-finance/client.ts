import YahooFinance from "yahoo-finance2";

/**
 * Shared Yahoo Finance client instance.
 * Initialized once and reused across all modules.
 */
export const yahooFinance = new YahooFinance({
  // Options here if needed
});
