/**
 * Simple mapping of asset categories to Yahoo Finance quote types
 */

export const ASSET_CATEGORY_QUOTE_TYPES: Record<string, string[]> = {
  cash: [],
  equity: ["EQUITY", "ETF"],
  fixed_income: ["MUTUALFUND", "ETF"],
  real_estate: [],
  commodities: ["FUTURES", "ETF"],
  cryptocurrency: ["CRYPTOCURRENCY"],
  other: [],
};

/**
 * Categories that should show symbol search
 */
export const CATEGORIES_WITH_SYMBOL_SEARCH = [
  "equity",
  "fixed_income",
  "commodities",
  "cryptocurrency",
];

export function shouldShowSymbolSearch(categoryCode: string): boolean {
  return CATEGORIES_WITH_SYMBOL_SEARCH.includes(categoryCode);
}

export function getQuoteTypesForCategory(categoryCode: string): string[] {
  return ASSET_CATEGORY_QUOTE_TYPES[categoryCode] || [];
}
