import { beforeEach, describe, expect, it, vi } from "vitest";

const createPortfolioRecordMutationMock = vi.fn();

vi.mock("@/server/portfolio-records/create", () => ({
  createPortfolioRecord: createPortfolioRecordMutationMock,
}));

const { createPortfolioRecord } = await import("./create-portfolio-record");

describe("createPortfolioRecord AI tool", () => {
  beforeEach(() => {
    createPortfolioRecordMutationMock.mockReset();
    createPortfolioRecordMutationMock.mockResolvedValue({ success: true });
  });

  it("marshals args into the mutation FormData shape", async () => {
    await createPortfolioRecord({
      summary: "Buy 20 × AAPL @ 211.50 USD on 2026-07-18",
      positionId: "0b0e4f9a-95ea-4c22-9c37-d44229f1e7ea",
      type: "buy",
      date: "2026-07-18",
      quantity: 20,
      unitValue: 211.5,
      description: "Broker sync",
      costBasisPerUnit: null,
    });

    const formData = createPortfolioRecordMutationMock.mock
      .calls[0]?.[0] as FormData;
    expect(formData.get("position_id")).toBe(
      "0b0e4f9a-95ea-4c22-9c37-d44229f1e7ea",
    );
    expect(formData.get("type")).toBe("buy");
    expect(formData.get("date")).toBe("2026-07-18");
    expect(formData.get("quantity")).toBe("20");
    expect(formData.get("unit_value")).toBe("211.5");
    expect(formData.get("description")).toBe("Broker sync");
  });

  it("omits null optionals and the UI-only summary", async () => {
    await createPortfolioRecord({
      summary: "Sell 5 × MSFT",
      positionId: "0b0e4f9a-95ea-4c22-9c37-d44229f1e7ea",
      type: "sell",
      date: "2026-07-18",
      quantity: 5,
      unitValue: 100,
      description: null,
      costBasisPerUnit: null,
    });

    const formData = createPortfolioRecordMutationMock.mock
      .calls[0]?.[0] as FormData;
    expect(formData.has("description")).toBe(false);
    expect(formData.has("cost_basis_per_unit")).toBe(false);
    expect(formData.has("summary")).toBe(false);
  });

  it("passes custom cost basis for update records", async () => {
    await createPortfolioRecord({
      summary: "Update quantity",
      positionId: "0b0e4f9a-95ea-4c22-9c37-d44229f1e7ea",
      type: "update",
      date: "2026-07-18",
      quantity: 12,
      unitValue: 80,
      description: null,
      costBasisPerUnit: 75.25,
    });

    const formData = createPortfolioRecordMutationMock.mock
      .calls[0]?.[0] as FormData;
    expect(formData.get("cost_basis_per_unit")).toBe("75.25");
  });

  it("returns the mutation result verbatim", async () => {
    const failure = {
      success: false,
      code: "INSUFFICIENT_QUANTITY",
      message: "Cannot sell more than held",
    };
    createPortfolioRecordMutationMock.mockResolvedValue(failure);

    const result = await createPortfolioRecord({
      summary: "Sell 500 × AAPL",
      positionId: "0b0e4f9a-95ea-4c22-9c37-d44229f1e7ea",
      type: "sell",
      date: "2026-07-18",
      quantity: 500,
      unitValue: 211.5,
      description: null,
      costBasisPerUnit: null,
    });

    expect(result).toBe(failure);
  });
});
