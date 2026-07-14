import { addHours } from "date-fns";
import { customAlphabet } from "nanoid";

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

const EXPIRATION_HOURS: Record<
  Exclude<PublicPortfolioExpirationOption, "never">,
  number
> = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

export const generateRandomString = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
);

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
  return addHours(new Date(), EXPIRATION_HOURS[option]).toISOString();
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
