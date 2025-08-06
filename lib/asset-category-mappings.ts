/**
 * Simple mapping of asset categories to Yahoo Finance quote types
 */

export const ASSET_CATEGORY_QUOTE_TYPES: Record<string, string[]> = {
  cash: ["CURRENCY", "MONEYMARKET"],
  equity: ["EQUITY", "ETF"],
  fixed_income: ["MUTUALFUND"],
  real_estate: [], // No specific quoteType for REITs in Yahoo Finance, usually handled as EQUITY or ETF
  commodities: ["FUTURE"],
  cryptocurrency: ["CRYPTOCURRENCY"],
  other: ["INDEX", "OPTION"], // Option and Index don’t neatly fit into the main categories
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

/**
 * Get category from Yahoo Finance quote type (reverse lookup)
 */
export function getCategoryFromQuoteType(quoteType: string): string | null {
  for (const [category, quoteTypes] of Object.entries(
    ASSET_CATEGORY_QUOTE_TYPES,
  )) {
    if (quoteTypes.includes(quoteType)) {
      return category;
    }
  }
  return null; // Return empty string if not found
}

export function getQuoteTypesForCategory(categoryCode: string): string[] {
  return ASSET_CATEGORY_QUOTE_TYPES[categoryCode] || [];
}

export function shouldShowSymbolSearch(categoryCode: string): boolean {
  return CATEGORIES_WITH_SYMBOL_SEARCH.includes(categoryCode);
}

export function shouldHideQuantity(categoryCode: string): boolean {
  return CATEGORIES_WITH_HIDDEN_QUANTITY.includes(categoryCode);
}
