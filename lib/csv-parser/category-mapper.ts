/**
 * Maps user-provided category names to our standardized category codes
 */

const CATEGORY_MAPPING = {
  cash: [
    "cash",
    "bank",
    "savings",
    "checking",
    "money market",
    "emergency fund",
  ],
  equity: [
    "equity",
    "stock",
    "stocks",
    "shares",
    "equities",
    "common stock",
    "etf",
    "index fund",
    "mutual fund",
    "fund",
    "tracker",
    "index",
  ],
  fixed_income: [
    "fixed_income",
    "bond",
    "bonds",
    "fixed income",
    "debt",
    "gov bond",
    "muni",
    "treasury",
  ],
  cryptocurrency: [
    "cryptocurrency",
    "crypto",
    "bitcoin",
    "ethereum",
    "altcoin",
    "token",
    "web3",
  ],
  real_estate: [
    "real_estate",
    "real estate",
    "property",
    "home",
    "house",
    "apartment",
    "land",
    "building",
    "rental",
  ],
  commodities: [
    "commodities",
    "commodity",
    "gold",
    "silver",
    "precious metals",
    "oil",
    "gas",
    "energy",
    "future",
    "futures",
  ],
  other: [
    "other",
    "pension",
    "retirement",
    "life insurance",
    "art",
    "car",
    "private equity",
    "angel",
    "collectible",
  ],
} as const;

// Compute once at module load time
const FLAT_MAPPING: Record<string, string> = {};
Object.entries(CATEGORY_MAPPING).forEach(([categoryCode, userInputs]) => {
  userInputs.forEach((input) => {
    const key = input.toLowerCase().trim();
    if (key in FLAT_MAPPING) {
      console.warn(
        `Duplicate input mapping for "${key}" found in "${categoryCode}"`,
      );
    } else {
      FLAT_MAPPING[key] = categoryCode;
    }
  });
});

/**
 * Maps a user-provided category to our standardized category code
 * @param userCategory - The category string from the CSV
 * @returns The standardized category code or "other" if no mapping found
 */
export function mapCategory(userCategory: string): string {
  const normalized = userCategory.toLowerCase().trim();
  return FLAT_MAPPING[normalized] || "other";
}
