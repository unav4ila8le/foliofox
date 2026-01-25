import { describe, it, expect } from "vitest";

import {
  MAX_SLUG_LENGTH,
  SLUG_SUFFIX_LENGTH,
  buildSlugCandidate,
  sanitizeSlug,
} from "./public-portfolio";

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
});
