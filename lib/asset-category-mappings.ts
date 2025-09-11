// Transaction types supported for each asset category
export const ASSET_CATEGORY_TRANSACTION_TYPES = {
  equity: ["buy", "sell", "update"],
  fixed_income: ["buy", "sell", "update"],
  real_estate: ["update"],
  cryptocurrency: ["buy", "sell", "update"],
  commodities: ["buy", "sell", "update"],
  cash: ["update"],
  other: ["update"],
};

// Transaction type labels
export const TRANSACTION_TYPE_LABELS = {
  buy: "Purchase",
  sell: "Sale",
  update: "Update",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
};

// Utility functions
export function getTransactionTypesForCategory(categoryCode: string): string[] {
  return (
    ASSET_CATEGORY_TRANSACTION_TYPES[
      categoryCode as keyof typeof ASSET_CATEGORY_TRANSACTION_TYPES
    ] || ["update"]
  );
}

export function getTransactionTypeLabel(type: string): string {
  return (
    TRANSACTION_TYPE_LABELS[type as keyof typeof TRANSACTION_TYPE_LABELS] ||
    type
  );
}

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
