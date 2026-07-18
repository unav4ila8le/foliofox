import { describe, expect, it } from "vitest";

import { getProductReference } from "./product-reference";

describe("getProductReference", () => {
  it("returns the product reference covering the key user questions", async () => {
    const { reference } = await getProductReference();

    // CSV import formats
    expect(reference).toContain("cost_basis_per_unit");
    expect(reference).toContain("symbol_lookup");
    expect(reference).toContain("position_name");

    // Record semantics
    expect(reference).toContain("`buy`");
    expect(reference).toContain("`sell`");
    expect(reference).toContain("`update`");

    // Broker imports
    expect(reference).toContain("Trade Republic");
    expect(reference).toContain("Scalable Capital");
    expect(reference).toContain("Directa");
  });
});
