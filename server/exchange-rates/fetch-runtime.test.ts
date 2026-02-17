import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchExchangeRates } from "@/server/exchange-rates/fetch";

type StoredExchangeRateRow = {
  base_currency: string;
  target_currency: string;
  date: string;
  rate: number;
};

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

function createSupabaseStub(initialRows: StoredExchangeRateRow[]) {
  const state = {
    rows: [...initialRows],
    cacheQueryCalls: [] as Array<{ currencies: string[]; dateKeys: string[] }>,
    upsertCalls: [] as Array<{
      rows: Array<{
        base_currency: string;
        target_currency: string;
        date: string;
        rate: number;
      }>;
      onConflict?: string;
    }>,
  };

  const exchangeRatesApi = {
    select() {
      let baseCurrency = "USD";
      let currencies: string[] = [];
      let dateKeys: string[] = [];

      return {
        eq(column: string, value: string) {
          if (column === "base_currency") {
            baseCurrency = value;
          }
          return this;
        },
        in(column: string, values: string[]) {
          if (column === "target_currency") {
            currencies = values;
          }
          if (column === "date") {
            dateKeys = values;
          }
          return this;
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: { data: unknown[]; error: null }) => TResult1)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          state.cacheQueryCalls.push({
            currencies: [...currencies],
            dateKeys: [...dateKeys],
          });

          const data = state.rows
            .filter(
              (row) =>
                row.base_currency === baseCurrency &&
                currencies.includes(row.target_currency) &&
                dateKeys.includes(row.date),
            )
            .map((row) => ({
              target_currency: row.target_currency,
              date: row.date,
              rate: row.rate,
            }));

          return Promise.resolve({ data, error: null }).then(
            onfulfilled ?? undefined,
            onrejected,
          );
        },
      };
    },
    async upsert(
      rows: Array<{
        base_currency: string;
        target_currency: string;
        date: string;
        rate: number;
      }>,
      options?: { onConflict?: string },
    ) {
      state.upsertCalls.push({
        rows: rows.map((row) => ({ ...row })),
        onConflict: options?.onConflict,
      });

      rows.forEach((row) => {
        const existingIndex = state.rows.findIndex(
          (existing) =>
            existing.base_currency === row.base_currency &&
            existing.target_currency === row.target_currency &&
            existing.date === row.date,
        );

        if (existingIndex >= 0) {
          state.rows[existingIndex] = { ...row };
          return;
        }

        state.rows.push({ ...row });
      });

      return { error: null };
    },
  };

  const client = {
    from(table: string) {
      if (table === "exchange_rates") {
        return exchangeRatesApi;
      }
      throw new Error(`Unexpected table "${table}" requested in test.`);
    },
  };

  return { client, state };
}

describe("fetchExchangeRates runtime behavior", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));

    createServiceClientMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses exact cache hit without live fetch", async () => {
    const { client } = createSupabaseStub([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-16",
        rate: 0.9,
      },
    ]);
    createServiceClientMock.mockResolvedValue(client);

    const result = await fetchExchangeRates([
      { currency: "EUR", date: new Date("2026-02-16T00:00:00.000Z") },
    ]);

    expect(result.get("EUR|2026-02-16")).toBe(0.9);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses latest prior cache row within stale window", async () => {
    const { client } = createSupabaseStub([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-14",
        rate: 0.88,
      },
    ]);
    createServiceClientMock.mockResolvedValue(client);

    const result = await fetchExchangeRates(
      [{ currency: "EUR", date: new Date("2026-02-16T00:00:00.000Z") }],
      { staleGuardDays: 7 },
    );

    expect(result.get("EUR|2026-02-16")).toBe(0.88);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("triggers live fetch when prior cache is outside stale guard", async () => {
    const { client, state } = createSupabaseStub([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-14",
        rate: 0.88,
      },
    ]);
    createServiceClientMock.mockResolvedValue(client);
    fetchMock.mockResolvedValue({
      json: async () => ({
        date: "2026-02-14",
        rates: { EUR: 0.91 },
      }),
    });

    const result = await fetchExchangeRates(
      [{ currency: "EUR", date: new Date("2026-02-16T00:00:00.000Z") }],
      { staleGuardDays: 1 },
    );

    expect(result.get("EUR|2026-02-16")).toBe(0.91);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]?.rows).toEqual([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-14",
        rate: 0.91,
      },
    ]);
  });

  it("with staleGuardDays=0 skips prior-date query and fetches live on exact miss", async () => {
    const { client, state } = createSupabaseStub([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-15",
        rate: 0.89,
      },
    ]);
    createServiceClientMock.mockResolvedValue(client);
    fetchMock.mockResolvedValue({
      json: async () => ({
        rates: { EUR: 0.92 },
      }),
    });

    const result = await fetchExchangeRates(
      [{ currency: "EUR", date: new Date("2026-02-16T00:00:00.000Z") }],
      { staleGuardDays: 0 },
    );

    expect(result.get("EUR|2026-02-16")).toBe(0.92);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.cacheQueryCalls).toHaveLength(1);
  });

  it("uses prior day effective date for today requests before cutoff", async () => {
    vi.setSystemTime(new Date("2026-02-20T21:00:00.000Z"));

    const { client } = createSupabaseStub([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-19",
        rate: 0.87,
      },
    ]);
    createServiceClientMock.mockResolvedValue(client);

    const result = await fetchExchangeRates([
      { currency: "EUR", date: new Date("2026-02-20T00:00:00.000Z") },
    ]);

    expect(result.get("EUR|2026-02-20")).toBe(0.87);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores fallback rates under fallback effective date (never requested synthetic date)", async () => {
    const { client, state } = createSupabaseStub([]);
    createServiceClientMock.mockResolvedValue(client);

    // 1) Frankfurter returns no EUR for requested effective date.
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ date: "2026-02-16", rates: {} }),
      })
      // 2) Fallback for 2026-02-16 has no EUR.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ usd: {} }),
      })
      // 3) Fallback for 2026-02-15 resolves EUR.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ usd: { eur: 0.93 } }),
      });

    const result = await fetchExchangeRates(
      [{ currency: "EUR", date: new Date("2026-02-16T00:00:00.000Z") }],
      { staleGuardDays: 0 },
    );

    expect(result.get("EUR|2026-02-16")).toBe(0.93);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]?.rows).toEqual([
      {
        base_currency: "USD",
        target_currency: "EUR",
        date: "2026-02-15",
        rate: 0.93,
      },
    ]);
    expect(
      state.upsertCalls[0]?.rows.some((row) => row.date === "2026-02-16"),
    ).toBe(false);
  });
});
