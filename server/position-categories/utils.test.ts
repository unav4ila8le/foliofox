import { describe, expect, it } from "vitest";

import { getUserCategoryLookupKey, normalizeUserCategoryName } from "./utils";

describe("position category utils", () => {
  it("normalizes category names by trimming whitespace", () => {
    expect(normalizeUserCategoryName("  Wine Collection  ")).toBe(
      "Wine Collection",
    );
  });

  it("compares category names case-insensitively", () => {
    expect(getUserCategoryLookupKey("Retirement")).toBe(
      getUserCategoryLookupKey("retirement"),
    );
  });
});
