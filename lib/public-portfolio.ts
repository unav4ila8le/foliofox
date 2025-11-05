import { addDays, addHours } from "date-fns";
import crypto from "node:crypto";

import type {
  PublicPortfolio,
  PublicPortfolioView,
  ShareDuration,
} from "@/types/global.types";

export const SLUG_PATTERN = /^[a-z0-9]+$/;
export const MAX_SLUG_LENGTH = 32;
export const SLUG_SUFFIX_LENGTH = 4;
export const ID_LENGTH = 12; // 3 < length < 16 per DB constraint
export const UNIQUE_VIOLATION_CODE = "23505";

export const SHARE_DURATIONS: ShareDuration[] = ["24h", "7d", "30d"];

const RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

const DURATION_TO_EXPIRY: Record<ShareDuration, (base: Date) => Date> = {
  "24h": (base) => addHours(base, 24),
  "7d": (base) => addDays(base, 7),
  "30d": (base) => addDays(base, 30),
};

export function generateRandomString(length: number) {
  let output = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % RANDOM_CHARS.length;
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

export function computeExpiry(duration: ShareDuration) {
  const handler = DURATION_TO_EXPIRY[duration];
  return handler(new Date());
}

export function isPortfolioActive(expiresAt: string | null) {
  return expiresAt ? new Date(expiresAt) > new Date() : false;
}

export function toPublicPortfolioView(
  row: PublicPortfolio,
  siteUrl: string,
): PublicPortfolioView {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const expiresAt = row.expires_at;

  return {
    id: row.id,
    slug: row.slug,
    shareUrl: `${normalizedSiteUrl}/portfolio/${row.slug}`,
    expiresAt,
    isActive: isPortfolioActive(expiresAt),
  };
}
