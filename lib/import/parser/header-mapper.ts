/**
 * Positions CSV/TSV Header Mapper
 *
 * Purpose:
 * - Normalize many broker/user header names to our canonical headers for position imports
 * - Extra/unknown columns are safely ignored
 * - Column order does not matter
 *
 * Canonical headers used by our position importer:
 *   - name
 *   - category_id
 *   - currency
 *   - quantity
 *   - unit_value
 *   - cost_basis_per_unit
 *   - symbol_lookup
 *   - description
 */

export type PositionCanonicalHeader =
  | "name"
  | "category_id"
  | "currency"
  | "quantity"
  | "unit_value"
  | "cost_basis_per_unit"
  | "symbol_lookup"
  | "description";

// Common aliases from brokers and spreadsheets (DEGIRO, IBKR, Trading212, Fidelity, Vanguard, Schwab, eToro, etc.)
const POSITION_HEADER_ALIASES: Record<PositionCanonicalHeader, string[]> = {
  // Position name/title
  name: [
    "name",
    "product",
    "title",
    "security description",
    "security name",
    "investment",
    "investment name",
    "instrument",
    "instrument name",
    "holding",
    "description",
    "position",
    "position name",
  ],

  // Symbol lookup value (ticker, ISIN, alias)
  symbol_lookup: [
    "symbol_lookup",
    "symbol id",
    "symbol_id",
    "symbol",
    "ticker",
    "ticker symbol",
    "isin",
    "symbol/isin",
    "security id",
    "security code",
  ],

  // Quantity / shares / units
  quantity: [
    "current_quantity",
    "current quantity",
    "quantity",
    "units",
    "shares",
    "amount",
    "position",
    "qty",
  ],

  // Unit price (the per-unit value; for cash/physical, users often set quantity=1)
  unit_value: [
    "unit_value",
    "current_unit_value",
    "current unit value",
    "price",
    "closing",
    "close",
    "close price",
    "closing price",
    "unit price",
    "last",
    "last price",
    "price/share",
    "price per share",
    "rate",
    "market price",
    "average price",
    "avg price",
  ],

  // Cost basis per unit
  cost_basis_per_unit: [
    "cost_basis_per_unit",
    "cost basis",
    "cost_basis",
    "basis",
    "purchase price",
    "buy price",
    "avg cost",
    "average cost",
    "book value",
  ],

  // Currency code (ISO 4217 where possible)
  currency: [
    "currency",
    "ccy",
    "curr",
    "portfolio currency",
    "trade currency",
    "holding currency",
    "position currency",
    "base currency",
    "instrument currency",
    "currency code",
  ],

  // Free-form note/description
  description: ["description", "notes", "comment", "memo", "details"],

  // Optional category hints (not required; we can infer later)
  category_id: [
    "category_id",
    "category_code",
    "category code",
    "category name",
    "category",
    "asset class",
    "asset type",
    "asset category",
    "type",
    "class",
  ],
};

const FLAT_POSITION_HEADER_MAP: Record<string, PositionCanonicalHeader> = {};
Object.entries(POSITION_HEADER_ALIASES).forEach(([canonical, aliases]) => {
  aliases.forEach((alias) => {
    const key = normalizeToken(alias);
    if (!(key in FLAT_POSITION_HEADER_MAP)) {
      FLAT_POSITION_HEADER_MAP[key] = canonical as PositionCanonicalHeader;
    }
  });
});

// Normalize header text for robust comparison
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/"/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[_\-]/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a raw header to a canonical position header, or null if unknown.
 * Unknown headers are simply ignored by the parser.
 */
export function normalizePositionHeader(
  rawHeader: string,
): PositionCanonicalHeader | null {
  const token = normalizeToken(rawHeader);
  return FLAT_POSITION_HEADER_MAP[token] ?? null;
}

/**
 * Build a canonical column map from raw CSV headers for position imports.
 * - Extra/unknown columns are ignored
 * - The first occurrence of a canonical header wins
 */
export function buildPositionColumnMap(
  rawHeaders: string[],
): Map<PositionCanonicalHeader, number> {
  const map = new Map<PositionCanonicalHeader, number>();

  rawHeaders.forEach((raw, index) => {
    const canonical = normalizePositionHeader(raw);
    if (!canonical) return;
    if (!map.has(canonical)) {
      map.set(canonical, index);
    }
  });

  return map;
}

/**
 * Minimal required canonical headers for position imports.
 * Note:
 * - We do NOT require `category_id`.
 * - For cash/physical/manual items, users typically set quantity=1 and put the total into unit value.
 */
export const REQUIRED_POSITION_HEADERS: PositionCanonicalHeader[] = [
  "name",
  "currency",
  "quantity",
];

/**
 * Helper: Are all required position headers present?
 */
export function hasRequiredPositionHeaders(
  map: Map<PositionCanonicalHeader, number>,
): { ok: true } | { ok: false; missing: PositionCanonicalHeader[] } {
  const missing = REQUIRED_POSITION_HEADERS.filter(
    (headerName) => !map.has(headerName),
  );
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}
