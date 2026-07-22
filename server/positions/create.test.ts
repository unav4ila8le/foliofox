import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const resolveSymbolInputMock = vi.fn();
const createPositionSnapshotMock = vi.fn();

// Chainable query stub: filters return the builder, awaiting it resolves the
// queued response (one entry per supabase.from() call, in call order).
const responseQueue: unknown[] = [];
function createQueryBuilder() {
  const response = responseQueue.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "is",
    "limit",
    "single",
    "maybeSingle",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.insert = vi.fn((row: unknown) => {
    insertMock(row);
    return builder;
  });
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(response).then(resolve);
  return builder;
}

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: vi.fn(async () => ({
    user: { id: "user-1" },
    supabase: { from: vi.fn(() => createQueryBuilder()) },
  })),
}));

vi.mock("@/server/symbols/resolve", () => ({
  resolveSymbolInput: resolveSymbolInputMock,
}));

vi.mock("@/server/symbols/create", () => ({
  createSymbol: vi.fn(),
}));

vi.mock("@/server/position-snapshots/create", () => ({
  createPositionSnapshot: createPositionSnapshotMock,
}));

vi.mock("@/server/quotes/fetch", () => ({
  fetchSingleQuote: vi.fn(async () => 100),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createPosition } = await import("./create");

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createPosition", () => {
  beforeEach(() => {
    insertMock.mockReset();
    resolveSymbolInputMock.mockReset();
    createPositionSnapshotMock.mockReset();
    createPositionSnapshotMock.mockResolvedValue({ success: true });
    responseQueue.length = 0;
    // Fresh-create from() order: duplicate-name check, position insert,
    // existing-snapshot check (finalize).
    responseQueue.push(
      { data: [], error: null },
      { data: { id: "position-1" }, error: null },
      { data: null, error: null },
    );
  });

  it("overrides the submitted currency with the symbol's trading currency", async () => {
    resolveSymbolInputMock.mockResolvedValue({
      symbol: { id: "symbol-1", currency: "GBP" },
    });

    const result = await createPosition(
      buildFormData({
        name: "Vodafone",
        currency: "GBp",
        symbolLookup: "VOD.L",
        quantity: "10",
        unit_value: "72.5",
        date: "2026-07-18",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(resolveSymbolInputMock).toHaveBeenCalledWith("VOD.L", {
      source: "yahoo",
      type: "ticker",
      activeOnly: true,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "GBP", symbol_id: "symbol-1" }),
    );
  });

  it("keeps the submitted currency for custom positions without a symbol", async () => {
    const result = await createPosition(
      buildFormData({
        name: "Vintage watch",
        currency: "CHF",
        quantity: "1",
        unit_value: "5000",
        date: "2026-07-18",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(resolveSymbolInputMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "CHF", symbol_id: null }),
    );
  });

  it("replays an idempotent create as a success without re-inserting", async () => {
    responseQueue.length = 0;
    // 1st from(): committed-position lookup by key, 2nd from(): the
    // existing-snapshot check inside finalize.
    responseQueue.push(
      { data: { id: "position-9", symbol_id: null }, error: null },
      { data: { id: "snapshot-1" }, error: null },
    );

    const result = await createPosition(
      buildFormData({
        name: "Vintage watch",
        currency: "CHF",
        quantity: "1",
        unit_value: "5000",
        date: "2026-07-18",
        idempotency_key: "call_abc123",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(insertMock).not.toHaveBeenCalled();
    expect(createPositionSnapshotMock).not.toHaveBeenCalled();
  });

  it("re-creates the missing initial snapshot when replaying a half-committed create", async () => {
    responseQueue.length = 0;
    // Committed position exists but the first attempt died before the
    // snapshot write: the replay must write it, not just report success.
    responseQueue.push(
      { data: { id: "position-9", symbol_id: null }, error: null },
      { data: null, error: null },
    );

    const result = await createPosition(
      buildFormData({
        name: "Vintage watch",
        currency: "CHF",
        quantity: "1",
        unit_value: "5000",
        date: "2026-07-18",
        idempotency_key: "call_abc123",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(insertMock).not.toHaveBeenCalled();
    expect(createPositionSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        position_id: "position-9",
        quantity: 1,
        unit_value: 5000,
      }),
    );
  });
});
