import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

type AliasRow = {
  id: string;
  symbol_id: string;
  value: string;
  effective_from: string;
};

function createSymbolsClient(rows: AliasRow[], errorAtCall?: number) {
  let queryCount = 0;

  return {
    queryCount: () => queryCount,
    client: {
      from: (table: string) => ({
        select: () => {
          expect(table).toBe("symbol_aliases");
          let cursor: string | null = null;
          let limit = 1_000;

          return {
            eq() {
              return this;
            },
            is() {
              return this;
            },
            order() {
              return this;
            },
            limit(value: number) {
              limit = value;
              return this;
            },
            gt(_column: string, value: string) {
              cursor = value;
              return this;
            },
            then<TResult1 = unknown, TResult2 = never>(
              onfulfilled?:
                | ((value: {
                    data: AliasRow[] | null;
                    error: { message: string } | null;
                  }) => TResult1)
                | null,
              onrejected?:
                ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ) {
              queryCount += 1;

              if (queryCount === errorAtCall) {
                return Promise.resolve({
                  data: null,
                  error: { message: "page failed" },
                }).then(onfulfilled ?? undefined, onrejected);
              }

              const page = rows
                .filter((row) => cursor === null || row.id > cursor)
                .slice(0, limit);

              return Promise.resolve({ data: page, error: null }).then(
                onfulfilled ?? undefined,
                onrejected,
              );
            },
          };
        },
      }),
    },
  };
}

describe("fetchSymbols", () => {
  beforeEach(() => {
    vi.resetModules();
    createServiceClientMock.mockReset();
  });

  it("keyset-paginates beyond 3,000 symbols", async () => {
    const rows = Array.from({ length: 3_001 }, (_, index) => ({
      id: `alias-${String(index).padStart(4, "0")}`,
      symbol_id: `symbol-${String(index).padStart(4, "0")}`,
      value: `T${index}`,
      effective_from: "2026-01-01T00:00:00.000Z",
    }));
    const { client, queryCount } = createSymbolsClient(rows);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchSymbols } = await import("./fetch");
    const result = await fetchSymbols();

    expect(result).toEqual(
      rows.map((row) => ({ id: row.symbol_id, ticker: row.value })),
    );
    expect(queryCount()).toBe(4);
  });

  it("deduplicates canonical IDs using the newest active alias", async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({
      id: `alias-${String(index).padStart(4, "0")}`,
      symbol_id:
        index === 1_000
          ? "symbol-0000"
          : `symbol-${String(index).padStart(4, "0")}`,
      value: index === 1_000 ? "NEW" : `T${index}`,
      effective_from:
        index === 1_000
          ? "2026-07-01T00:00:00.000Z"
          : "2026-01-01T00:00:00.000Z",
    }));
    const { client, queryCount } = createSymbolsClient(rows);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchSymbols } = await import("./fetch");
    const result = await fetchSymbols();

    expect(result).toHaveLength(1_000);
    expect(result[0]).toEqual({ id: "symbol-0000", ticker: "NEW" });
    expect(queryCount()).toBe(2);
  });

  it("reports pagination errors", async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({
      id: `alias-${String(index).padStart(4, "0")}`,
      symbol_id: `symbol-${String(index).padStart(4, "0")}`,
      value: `T${index}`,
      effective_from: "2026-01-01T00:00:00.000Z",
    }));
    const { client } = createSymbolsClient(rows, 2);
    createServiceClientMock.mockResolvedValue(client);

    const { fetchSymbols } = await import("./fetch");

    await expect(fetchSymbols()).rejects.toThrow(
      "Failed to fetch symbols: page failed",
    );
  });
});
