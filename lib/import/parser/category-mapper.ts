/**
 * Category Mapper
 *
 * Purpose:
 * - Map user/broker/spreadsheet category strings to our canonical category codes
 * - Robust normalization (spacing, punctuation, hyphens, cases)
 * - Rich alias set for common real-world terms
 * - Safe defaults (fallback to "other")
 *
 * Canonical category codes:
 *   - cash
 *   - equity
 *   - fixed_income
 *   - real_estate
 *   - cryptocurrency
 *   - commodities
 *   - other
 */

export type CategoryCode =
  | "cash"
  | "equity"
  | "fixed_income"
  | "real_estate"
  | "cryptocurrency"
  | "commodities"
  | "other";

export const CATEGORY_CODES: CategoryCode[] = [
  "cash",
  "equity",
  "fixed_income",
  "real_estate",
  "cryptocurrency",
  "commodities",
  "other",
];

/**
 * Normalize a free-form category token for robust matching
 */
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD") // split accents
    .replace(/\p{Diacritic}/gu, "") // drop accents
    .trim()
    .replace(/\u00A0/g, " ") // non-breaking spaces
    .replace(/["']/g, "")
    .replace(/&/g, " and ")
    .replace(/[_\-]/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aliases gathered from brokers/spreadsheets/common phrasing.
 * Note on REITs:
 * - We map "reit" to real_estate to align with user expectations.
 */
const CATEGORY_ALIASES: Record<CategoryCode, string[]> = {
  cash: [
    "cash",
    "cash equivalents",
    "cash and cash equivalents",
    "bank",
    "bank account",
    "savings",
    "savings account",
    "checking",
    "checking account",
    "current account",
    "money market",
    "money-market",
    "mmf",
    "cd",
    "certificate of deposit",
    "emergency fund",
  ],

  equity: [
    "equity",
    "equities",
    "stock",
    "stocks",
    "shares",
    "common stock",
    "etf",
    "index",
    "index fund",
    "mutual fund",
    "fund",
    "tracker",
  ],

  fixed_income: [
    "fixed income",
    "fixed_income",
    "bond",
    "bonds",
    "bond fund",
    "bond etf",
    "debt",
    "gov bond",
    "government bond",
    "treasury",
    "treasuries",
    "muni",
    "municipal",
    "gilt",
    "gilts",
    "corporate bond",
    "corporate bonds",
  ],

  real_estate: [
    "real estate",
    "real_estate",
    "property",
    "home",
    "house",
    "apartment",
    "condo",
    "condominium",
    "land",
    "building",
    "rental",
    "reit",
    "reits",
    "real estate investment trust",
    "reit etf",
  ],

  cryptocurrency: [
    "cryptocurrency",
    "crypto",
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "altcoin",
    "token",
    "web3",
    "stablecoin",
    "usdt",
    "usdc",
  ],

  commodities: [
    "commodities",
    "commodity",
    "metal",
    "metals",
    "precious metal",
    "precious metals",
    "gold",
    "silver",
    "oil",
    "gas",
    "energy",
    "future",
    "futures",
    "wti",
    "brent",
    "corn",
    "wheat",
    "soybean",
    "commodity etf",
    "gold etf",
    "silver etf",
  ],

  other: [
    "other",
    "pension",
    "retirement",
    "life insurance",
    "insurance",
    "art",
    "artwork",
    "car",
    "vehicle",
    "watch",
    "jewelry",
    "collectible",
    "collectibles",
    "private equity",
    "angel",
    "vc",
    "venture capital",
    "luxury",
  ],
};

// Build a flat lookup map once
const FLAT_CATEGORY_MAP: Record<string, CategoryCode> = {};
Object.entries(CATEGORY_ALIASES).forEach(([code, aliases]) => {
  aliases.forEach((alias) => {
    const key = normalizeToken(alias);
    if (
      key in FLAT_CATEGORY_MAP &&
      FLAT_CATEGORY_MAP[key] !== (code as CategoryCode)
    ) {
      // Soft overwrite with first come, first served; no console.warn to keep it quiet in production
      return;
    }
    FLAT_CATEGORY_MAP[key] = code as CategoryCode;
  });
});

/**
 * Is the provided string already a valid canonical category code?
 */
export function isCategoryCode(input: string): input is CategoryCode {
  return CATEGORY_CODES.includes(input as CategoryCode);
}

/**
 * Map a user-provided category to our canonical category code.
 * - If it's already a canonical code, return it.
 * - Else, try alias lookup (robust normalization).
 * - Else, fallback to "other".
 */
export function mapCategory(
  userCategory: string | null | undefined,
): CategoryCode {
  if (!userCategory || !userCategory.trim()) return "other";

  const raw = userCategory.trim();
  if (isCategoryCode(raw)) return raw;

  const key = normalizeToken(raw);
  return FLAT_CATEGORY_MAP[key] || "other";
}
