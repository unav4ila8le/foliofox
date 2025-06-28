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

/**
 * Categories that should hide quantity field (auto-set to 1)
 */
export const CATEGORIES_WITH_HIDDEN_QUANTITY = ["cash", "real_estate"];

export function getQuoteTypesForCategory(categoryCode: string): string[] {
  return ASSET_CATEGORY_QUOTE_TYPES[categoryCode] || [];
}

export function shouldShowSymbolSearch(categoryCode: string): boolean {
  return CATEGORIES_WITH_SYMBOL_SEARCH.includes(categoryCode);
}

export function shouldHideQuantity(categoryCode: string): boolean {
  return CATEGORIES_WITH_HIDDEN_QUANTITY.includes(categoryCode);
}
