import { beforeEach, describe, expect, it, vi } from "vitest";

const createPositionMutationMock = vi.fn();

vi.mock("@/server/positions/create", () => ({
  createPosition: createPositionMutationMock,
}));

const { createPosition } = await import("./create-position");

const baseParams = {
  summary: "Add position VWCE.DE: 15 units (ETFs)",
  name: "Vanguard FTSE All-World",
  currency: "EUR",
  type: null,
  categoryId: null,
  userCategoryId: null,
  symbolLookup: null,
  quantity: null,
  unitValue: null,
  costBasisPerUnit: null,
  capitalGainsTaxRate: null,
  date: null,
  description: null,
};

describe("createPosition AI tool", () => {
  beforeEach(() => {
    createPositionMutationMock.mockReset();
    createPositionMutationMock.mockResolvedValue({ success: true });
  });

  it("marshals all provided args into the mutation FormData shape", async () => {
    await createPosition({
      ...baseParams,
      type: "asset",
      categoryId: "etfs",
      symbolLookup: "VWCE.DE",
      quantity: 15,
      unitValue: 130.2,
      costBasisPerUnit: 120,
      capitalGainsTaxRate: 26,
      date: "2026-07-18",
      description: "Broker sync",
    });

    const formData = createPositionMutationMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Vanguard FTSE All-World");
    expect(formData.get("currency")).toBe("EUR");
    expect(formData.get("type")).toBe("asset");
    expect(formData.get("category_id")).toBe("etfs");
    expect(formData.get("symbolLookup")).toBe("VWCE.DE");
    expect(formData.get("quantity")).toBe("15");
    expect(formData.get("unit_value")).toBe("130.2");
    expect(formData.get("cost_basis_per_unit")).toBe("120");
    // Model provides a percentage; the DB CHECK requires a 0..1 decimal.
    expect(formData.get("capital_gains_tax_rate")).toBe("0.26");
    expect(formData.get("date")).toBe("2026-07-18");
    expect(formData.get("description")).toBe("Broker sync");
  });

  it("keeps an already-decimal tax rate unchanged", async () => {
    await createPosition({ ...baseParams, capitalGainsTaxRate: 0.26 });

    const formData = createPositionMutationMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("capital_gains_tax_rate")).toBe("0.26");
  });

  it("omits null optionals so the mutation keeps its defaults", async () => {
    await createPosition(baseParams);

    const formData = createPositionMutationMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Vanguard FTSE All-World");
    expect(formData.get("currency")).toBe("EUR");
    for (const key of [
      "type",
      "category_id",
      "user_category_id",
      "symbolLookup",
      "quantity",
      "unit_value",
      "cost_basis_per_unit",
      "capital_gains_tax_rate",
      "date",
      "description",
      "summary",
    ]) {
      expect(formData.has(key)).toBe(false);
    }
  });

  it("supports custom user categories", async () => {
    await createPosition({
      ...baseParams,
      userCategoryId: "9a1f61a1-51b2-4c53-a2be-2f9b31c1a111",
    });

    const formData = createPositionMutationMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("user_category_id")).toBe(
      "9a1f61a1-51b2-4c53-a2be-2f9b31c1a111",
    );
  });

  it("returns the mutation result verbatim", async () => {
    const failure = {
      success: false,
      code: "DUPLICATE_NAME",
      message: "A position with this name already exists",
    };
    createPositionMutationMock.mockResolvedValue(failure);

    const result = await createPosition(baseParams);

    expect(result).toBe(failure);
  });
});
