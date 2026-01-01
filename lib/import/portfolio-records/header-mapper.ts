/**
 * Portfolio Records CSV/TSV Header Mapper
 *
 * Purpose:
 * - Normalize various header names to our canonical headers for portfolio record imports
 * - Supports common broker/spreadsheet naming conventions
 * - Extra/unknown columns are safely ignored
 * - Column order does not matter
 *
 * Canonical headers for portfolio records:
 *   - position_name (required)
 *   - type (required) - buy/sell/update
 *   - date (required)
 *   - quantity (required)
 *   - unit_value (required)
 *   - description (optional)
 */

export type PortfolioRecordCanonicalHeader =
  | "position_name"
  | "type"
  | "date"
  | "quantity"
  | "unit_value"
  | "description";

// Common aliases from brokers and spreadsheets
const PORTFOLIO_RECORD_HEADER_ALIASES: Record<
  PortfolioRecordCanonicalHeader,
  string[]
> = {
  // Position name to match against existing positions
  position_name: [
    "position_name",
    "position name",
    "position",
    "holding",
    "holding name",
    "asset",
    "asset name",
    "security",
    "security name",
    "instrument",
    "instrument name",
    "name",
    "product",
    "symbol",
    "ticker",
  ],

  // Record type (buy/sell/update)
  type: [
    "type",
    "record type",
    "record_type",
    "transaction type",
    "transaction_type",
    "action",
    "trade type",
    "trade_type",
    "side",
    "operation",
  ],

  // Transaction date
  date: [
    "date",
    "transaction date",
    "transaction_date",
    "trade date",
    "trade_date",
    "settlement date",
    "settlement_date",
    "execution date",
    "execution_date",
    "record date",
    "record_date",
  ],

  // Quantity
  quantity: [
    "quantity",
    "qty",
    "units",
    "shares",
    "amount",
    "size",
    "volume",
    "no of shares",
    "number of shares",
  ],

  // Unit value / price
  unit_value: [
    "unit_value",
    "unit value",
    "price",
    "unit price",
    "unit_price",
    "price per unit",
    "price per share",
    "share price",
    "rate",
    "value",
    "cost",
    "execution price",
  ],

  // Optional description
  description: [
    "description",
    "notes",
    "note",
    "comment",
    "comments",
    "memo",
    "details",
    "remarks",
  ],
};

const FLAT_PORTFOLIO_RECORD_HEADER_MAP: Record<
  string,
  PortfolioRecordCanonicalHeader
> = {};
Object.entries(PORTFOLIO_RECORD_HEADER_ALIASES).forEach(
  ([canonical, aliases]) => {
    aliases.forEach((alias) => {
      const key = normalizeToken(alias);
      if (!(key in FLAT_PORTFOLIO_RECORD_HEADER_MAP)) {
        FLAT_PORTFOLIO_RECORD_HEADER_MAP[key] =
          canonical as PortfolioRecordCanonicalHeader;
      }
    });
  },
);

/**
 * Normalize header text for robust comparison.
 * Handles diacritics, whitespace, underscores, dashes, quotes, etc.
 */
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
 * Map a raw header to a canonical portfolio record header, or null if unknown.
 * Unknown headers are simply ignored by the parser.
 */
export function normalizePortfolioRecordHeader(
  rawHeader: string,
): PortfolioRecordCanonicalHeader | null {
  const token = normalizeToken(rawHeader);
  return FLAT_PORTFOLIO_RECORD_HEADER_MAP[token] ?? null;
}

/**
 * Build a canonical column map from raw CSV headers for portfolio record imports.
 * - Extra/unknown columns are ignored
 * - The first occurrence of a canonical header wins
 */
export function buildPortfolioRecordColumnMap(
  rawHeaders: string[],
): Map<PortfolioRecordCanonicalHeader, number> {
  const map = new Map<PortfolioRecordCanonicalHeader, number>();

  rawHeaders.forEach((raw, index) => {
    const canonical = normalizePortfolioRecordHeader(raw);
    if (!canonical) return;
    if (!map.has(canonical)) {
      map.set(canonical, index);
    }
  });

  return map;
}

/**
 * Required canonical headers for portfolio record imports.
 */
export const REQUIRED_PORTFOLIO_RECORD_HEADERS: PortfolioRecordCanonicalHeader[] =
  ["position_name", "type", "date", "quantity", "unit_value"];

/**
 * Helper: Are all required portfolio record headers present?
 */
export function hasRequiredPortfolioRecordHeaders(
  map: Map<PortfolioRecordCanonicalHeader, number>,
): { ok: true } | { ok: false; missing: PortfolioRecordCanonicalHeader[] } {
  const missing = REQUIRED_PORTFOLIO_RECORD_HEADERS.filter(
    (headerName) => !map.has(headerName),
  );
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}
