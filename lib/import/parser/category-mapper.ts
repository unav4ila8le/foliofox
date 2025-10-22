/**
 * Category Mapper
 *
 * Purpose:
 * - Map user/broker/spreadsheet category strings to our canonical category IDs
 * - Robust normalization (spacing, punctuation, hyphens, cases)
 * - Rich alias set for common real-world terms
 * - Safe defaults (fallback to "other")
 *
 * Canonical category IDs:
 *   - cash
 *   - equity
 *   - fixed_income
 *   - real_estate
 *   - cryptocurrency
 *   - commodities
 *   - domain
 *   - other
 */

export type CategoryId =
  | "cash"
  | "equity"
  | "fixed_income"
  | "real_estate"
  | "cryptocurrency"
  | "commodities"
  | "domain"
  | "other";

export const CATEGORY_IDS: CategoryId[] = [
  "cash",
  "equity",
  "fixed_income",
  "real_estate",
  "cryptocurrency",
  "commodities",
  "domain",
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
const CATEGORY_ALIASES: Record<CategoryId, string[]> = {
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

  domain: [
    "domain",
    "domain name",
    "domain registration",
    "domain name registration",
    "domain address",
    "web address",
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
const FLAT_CATEGORY_MAP: Record<string, CategoryId> = {};
Object.entries(CATEGORY_ALIASES).forEach(([id, aliases]) => {
  aliases.forEach((alias) => {
    const key = normalizeToken(alias);
    if (
      key in FLAT_CATEGORY_MAP &&
      FLAT_CATEGORY_MAP[key] !== (id as CategoryId)
    ) {
      // Soft overwrite with first come, first served; no console.warn to keep it quiet in production
      return;
    }
    FLAT_CATEGORY_MAP[key] = id as CategoryId;
  });
});

/**
 * Is the provided string already a valid canonical category id?
 */
export function isCategoryId(input: string): input is CategoryId {
  return CATEGORY_IDS.includes(input as CategoryId);
}

/**
 * Map a user-provided category to our canonical category id.
 * - If it's already a canonical id, return it.
 * - Else, try alias lookup (robust normalization).
 * - Else, fallback to "other".
 */
export function mapCategory(
  userCategory: string | null | undefined,
): CategoryId {
  if (!userCategory || !userCategory.trim()) return "other";

  const raw = userCategory.trim();
  if (isCategoryId(raw)) return raw;

  const key = normalizeToken(raw);
  return FLAT_CATEGORY_MAP[key] || "other";
}
