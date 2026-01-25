import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  MAX_SLUG_LENGTH,
  SLUG_SUFFIX_LENGTH,
  FOREVER_EXPIRATION,
  buildSlugCandidate,
  sanitizeSlug,
  computeExpiration,
  isPortfolioActive,
  toPublicPortfolioMetadata,
  generateRandomString,
} from "./public-portfolio";

import { PublicPortfolio } from "@/types/global.types";

// 1. Helper Functions
// Simple utility functions that don't depend on external state or time.
describe("public-portfolio helpers", () => {
  it("sanitizeSlug lowercases and strips non-alphanumeric characters", () => {
    const input = "My_Slug--With Spaces!!";
    expect(sanitizeSlug(input)).toBe("myslugwithspaces");
  });

  it("sanitizeSlug caps length at MAX_SLUG_LENGTH", () => {
    const input = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const result = sanitizeSlug(input);

    expect(result.length).toBe(MAX_SLUG_LENGTH);
    expect(result).toBe(result.toLowerCase());
  });

  it("buildSlugCandidate returns base on first attempt", () => {
    expect(buildSlugCandidate("simple", 0)).toBe("simple");
  });

  it("buildSlugCandidate appends a suffix and respects max length", () => {
    const base = "a".repeat(MAX_SLUG_LENGTH + 10);
    const result = buildSlugCandidate(base, 1);

    expect(result.length).toBe(MAX_SLUG_LENGTH);
    const trimmedBase = base.slice(
      0,
      Math.max(1, MAX_SLUG_LENGTH - SLUG_SUFFIX_LENGTH),
    );
    expect(result.startsWith(trimmedBase)).toBe(true);
  });

  it("generateRandomString produces string of correct length", () => {
    expect(generateRandomString(10).length).toBe(10);
    expect(generateRandomString(5)).toMatch(/^[a-z0-9]+$/);
  });
});

// 2. Expiration Logic
// These tests involve time calculations. We MUST freeze the system time
// using vi.useFakeTimers() to ensure tests pass consistently in the future.
describe("expiration logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-23T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it("adds exactly 24 hours for '24h' option", () => {
    const result = computeExpiration("24h");
    expect(result).toBe("2026-01-24T00:00:00.000Z");
  });

  it("adds exactly 7 days for '7d' option", () => {
    const result = computeExpiration("7d");
    expect(result).toBe("2026-01-30T00:00:00.000Z");
  });

  it("adds exactly 30 days for '30d' option", () => {
    const result = computeExpiration("30d");
    expect(result).toBe("2026-02-22T00:00:00.000Z");
  });

  it("returns infinity constant for 'never'", () => {
    expect(computeExpiration("never")).toBe(FOREVER_EXPIRATION);
  });
});

// 3. Activity Check
// Determines if a portfolio is viewable based on its expiration date.
// Also requires time mocking to compare "now" vs "expiresAt".
describe("isPortfolioActive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-25T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false if expiresAt is null", () => {
    expect(isPortfolioActive(null)).toBe(false);
  });

  it("returns true for FOREVER_EXPIRATION", () => {
    expect(isPortfolioActive(FOREVER_EXPIRATION)).toBe(true);
  });

  it("returns true if expiration is in the future", () => {
    // 1 second in the future
    expect(isPortfolioActive("2026-01-25T12:00:01Z")).toBe(true);
  });

  it("returns false if expiration is in the past", () => {
    // 1 second in the past
    expect(isPortfolioActive("2026-01-25T11:59:59Z")).toBe(false);
  });
});

// 4. Data Transformation (Adapter)
// Tests the conversion from raw Database rows to the shape the Frontend expects.
// verify that URLs are built correctly and flags (isActive) are computed.
describe("toPublicPortfolioMetadata", () => {
  const mockPortfolio: PublicPortfolio = {
    id: "uuid-123",
    slug: "my-portfolio",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    user_id: "user-1",
    expires_at: null,
  };

  it("transforms portfolio row correctly", () => {
    const row = { ...mockPortfolio, expires_at: "2026-02-01T00:00:00Z" };
    const siteUrl = "https://example.com";

    const result = toPublicPortfolioMetadata(row, siteUrl);

    expect(result).toEqual({
      id: "uuid-123",
      slug: "my-portfolio",
      shareUrl: "https://example.com/portfolio/my-portfolio",
      expiresAt: "2026-02-01T00:00:00Z",
      isActive: expect.any(Boolean), // We strictly test isActive logic separately
      neverExpires: false,
    });
  });

  it("strips trailing slash from siteUrl", () => {
    const row = { ...mockPortfolio, expires_at: null };
    const result = toPublicPortfolioMetadata(row, "https://example.com/");
    expect(result.shareUrl).toBe("https://example.com/portfolio/my-portfolio");
  });

  it("sets neverExpires flag correctly", () => {
    const row = { ...mockPortfolio, expires_at: FOREVER_EXPIRATION };
    const result = toPublicPortfolioMetadata(row, "https://example.com");
    expect(result.neverExpires).toBe(true);
  });
});
