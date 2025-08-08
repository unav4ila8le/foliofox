// Simple mapping of asset categories to Yahoo Finance quote types
const ASSET_CATEGORY_QUOTE_TYPES: Record<string, string[]> = {
  cash: ["CURRENCY", "MONEYMARKET"],
  equity: ["EQUITY", "ETF"],
  fixed_income: ["MUTUALFUND"],
  real_estate: [], // No specific quoteType for REITs in Yahoo Finance, usually handled as EQUITY or ETF
  commodities: ["FUTURE"],
  cryptocurrency: ["CRYPTOCURRENCY"],
  other: ["INDEX", "OPTION"], // Option and Index don’t neatly fit into the main categories
};

// Get category from Yahoo Finance quote type (reverse lookup)
export function getCategoryFromQuoteType(quoteType: string): string | null {
  for (const [category, quoteTypes] of Object.entries(
    ASSET_CATEGORY_QUOTE_TYPES,
  )) {
    if (quoteTypes.includes(quoteType)) {
      return category;
    }
  }
  return null; // Return null if not found
}
