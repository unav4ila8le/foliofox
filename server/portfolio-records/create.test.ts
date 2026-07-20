import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const insertMock = vi.fn();

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
  recalculateSnapshotsUntilNextUpdate: vi.fn(),
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
  });

  it("returns success without inserting when the idempotency key already committed", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: "record-1" } });

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
  });
});
