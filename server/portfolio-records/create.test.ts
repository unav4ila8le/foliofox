import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const recalculateMock = vi.fn();

// Chainable query stub: every filter returns the builder, terminals resolve.
function createQueryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = maybeSingleMock;
  builder.insert = insertMock;
  return builder;
}

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: vi.fn(async () => ({
    user: { id: "user-1" },
    supabase: { from: vi.fn(() => createQueryBuilder()) },
  })),
}));

vi.mock("@/server/position-snapshots/recalculate", () => ({
  recalculateSnapshotsUntilNextUpdate: recalculateMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createPortfolioRecord } = await import("./create");

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createPortfolioRecord replay handling", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    insertMock.mockReset();
    recalculateMock.mockReset();
    recalculateMock.mockResolvedValue({ success: true });
  });

  it("re-runs recalculation for the committed record without re-inserting", async () => {
    // The first attempt may have died between insert and recalculation, so a
    // replay must recalculate from the stored record instead of skipping it.
    maybeSingleMock.mockResolvedValue({
      data: { id: "record-1", position_id: "position-9", date: "2026-07-10" },
    });

    const result = await createPortfolioRecord(
      buildFormData({
        position_id: "position-1",
        type: "sell",
        date: "2026-07-18",
        quantity: "5",
        unit_value: "100",
        idempotency_key: "call_abc123",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(insertMock).not.toHaveBeenCalled();
    expect(recalculateMock).toHaveBeenCalledWith({
      positionId: "position-9",
      fromDate: new Date("2026-07-10"),
      customCostBasisByRecordId: undefined,
    });
  });

  it("preserves a submitted custom cost basis when replaying an update", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "record-2", position_id: "position-9", date: "2026-07-10" },
    });

    await createPortfolioRecord(
      buildFormData({
        position_id: "position-1",
        type: "update",
        date: "2026-07-18",
        quantity: "12",
        unit_value: "80",
        cost_basis_per_unit: "75.25",
        idempotency_key: "call_def456",
      }),
    );

    expect(recalculateMock).toHaveBeenCalledWith({
      positionId: "position-9",
      fromDate: new Date("2026-07-10"),
      customCostBasisByRecordId: { "record-2": 75.25 },
    });
  });
});
