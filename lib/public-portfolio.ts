import { addDays, addHours } from "date-fns";
import { randomInt } from "crypto";

import type {
  PublicPortfolio,
  PublicPortfolioMetadata,
  PublicPortfolioExpirationOption,
} from "@/types/global.types";

export const SLUG_PATTERN = /^[a-z0-9]+$/;
export const MAX_SLUG_LENGTH = 32;
export const SLUG_SUFFIX_LENGTH = 4;
export const UNIQUE_VIOLATION_CODE = "23505";

export const PUBLIC_PORTFOLIO_EXPIRATIONS = [
  "24h",
  "7d",
  "30d",
  "never",
] as const;

export const FOREVER_EXPIRATION = "infinity";

const RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

const EXPIRATION_CALCULATORS: Record<
  Exclude<PublicPortfolioExpirationOption, "never">,
  (base: Date) => Date
> = {
  "24h": (base) => addHours(base, 24),
  "7d": (base) => addDays(base, 7),
  "30d": (base) => addDays(base, 30),
};

export function generateRandomString(length: number) {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const index = randomInt(RANDOM_CHARS.length);
    output += RANDOM_CHARS[index];
  }
  return output;
}

export function sanitizeSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function buildSlugCandidate(base: string, attempt: number) {
  if (attempt === 0) return base;
  const trimmedBase = base.slice(
    0,
    Math.max(1, MAX_SLUG_LENGTH - SLUG_SUFFIX_LENGTH),
  );
  return `${trimmedBase}${generateRandomString(SLUG_SUFFIX_LENGTH)}`;
}

export function computeExpiration(
  option: PublicPortfolioExpirationOption,
): string {
  if (option === "never") {
    return FOREVER_EXPIRATION;
  }
  const handler = EXPIRATION_CALCULATORS[option];
  return handler(new Date()).toISOString();
}

export function isPortfolioActive(expiresAt: string | null) {
  if (!expiresAt) return false;
  if (expiresAt === FOREVER_EXPIRATION) return true;
  return new Date(expiresAt) > new Date();
}

export function toPublicPortfolioMetadata(
  row: PublicPortfolio,
  siteUrl: string,
): PublicPortfolioMetadata {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const expiresAt = row.expires_at;
  const neverExpires = expiresAt === FOREVER_EXPIRATION;

  return {
    id: row.id,
    slug: row.slug,
    shareUrl: `${normalizedSiteUrl}/portfolio/${row.slug}`,
    expiresAt,
    isActive: isPortfolioActive(expiresAt),
    neverExpires,
  };
}
