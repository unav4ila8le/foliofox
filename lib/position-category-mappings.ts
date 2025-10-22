// Simple mapping of position categories to Yahoo Finance quote types
const POSITION_CATEGORY_QUOTE_TYPES: Record<string, string[]> = {
  cash: ["CURRENCY", "MONEYMARKET"],
  equity: ["EQUITY", "ETF"],
  fixed_income: ["MUTUALFUND"],
  real_estate: [], // REITs typically appear as EQUITY/ETF in Yahoo Finance
  commodities: ["FUTURE"],
  cryptocurrency: ["CRYPTOCURRENCY"],
  domain: [],
  other: ["INDEX", "OPTION"], // Option and Index don't neatly fit into main categories
};

// Get position category key from Yahoo Finance quote type (reverse lookup)
export function getPositionCategoryKeyFromQuoteType(
  quoteType: string,
): string | null {
  for (const [categoryKey, quoteTypes] of Object.entries(
    POSITION_CATEGORY_QUOTE_TYPES,
  )) {
    if (quoteTypes.includes(quoteType)) {
      return categoryKey;
    }
  }
  return null; // Return null if not found
}
