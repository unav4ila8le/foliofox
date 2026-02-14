import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const fetchProfileMock = vi.fn();
const fetchExchangeRatesMock = vi.fn();
const fetchMarketDataRangeMock = vi.fn();
const toMarketDataPositionsMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/server/profile/actions", () => ({
  fetchProfile: fetchProfileMock,
}));

vi.mock("@/server/exchange-rates/fetch", () => ({
  fetchExchangeRates: fetchExchangeRatesMock,
}));

vi.mock("@/server/market-data/fetch", () => ({
  fetchMarketDataRange: fetchMarketDataRangeMock,
  toMarketDataPositions: toMarketDataPositionsMock,
}));

type FakeQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

class FakeSupabaseQuery {
  constructor(private readonly result: FakeQueryResult) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  in() {
    return this;
  }

  lte() {
    return this;
  }

  order() {
    return this;
  }

  then<TResult1 = FakeQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createSupabaseStub(options: {
  positions: unknown[];
  snapshots: unknown[];
}) {
  return {
    from: (table: string) => {
      if (table === "positions") {
        return new FakeSupabaseQuery({
          data: options.positions,
          error: null,
        });
      }

      if (table === "position_snapshots") {
        return new FakeSupabaseQuery({
          data: options.snapshots,
          error: null,
        });
      }

      throw new Error(`Unexpected table in test stub: ${table}`);
    },
  };
}

function toDateKeyList(values: Array<{ date: Date; value: number }>) {
  return values.map((item) => ({
    date: item.date.toISOString().slice(0, 10),
    value: item.value,
  }));
}

describe("fetchNetWorthHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00.000Z"));

    getCurrentUserMock.mockReset();
    fetchProfileMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    fetchMarketDataRangeMock.mockReset();
    toMarketDataPositionsMock.mockReset();

    fetchProfileMock.mockResolvedValue({
      profile: { display_currency: "USD" },
    });
    fetchExchangeRatesMock.mockResolvedValue(new Map());
    toMarketDataPositionsMock.mockImplementation(async (positions: unknown[]) =>
      (
        positions as Array<{
          id: string;
          currency: string;
          symbol_id: string | null;
          domain_id: string | null;
        }>
      ).map((position) => ({
        id: position.id,
        currency: position.currency,
        symbol_id: position.symbol_id,
        domain_id: position.domain_id,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves gross history semantics with sparse snapshots and market fallback", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub({
        positions: [
          {
            id: "pos-1",
            currency: "USD",
            symbol_id: "sym-1",
            domain_id: null,
            user_id: "user-1",
            type: "asset",
            capital_gains_tax_rate: null,
          },
        ],
        snapshots: [
          {
            id: "snap-1",
            position_id: "pos-1",
            date: "2026-01-03",
            quantity: 2,
            unit_value: 100,
            created_at: "2026-01-03T10:00:00.000Z",
            cost_basis_per_unit: 80,
          },
          {
            id: "snap-2",
            position_id: "pos-1",
            date: "2026-01-04",
            quantity: 2,
            unit_value: 110,
            created_at: "2026-01-04T10:00:00.000Z",
            cost_basis_per_unit: null,
          },
        ],
      }),
    });

    fetchMarketDataRangeMock.mockResolvedValue(
      new Map([["pos-1|2026-01-03", 120]]),
    );

    const { fetchNetWorthHistory } = await import("./net-worth-history");
    const result = await fetchNetWorthHistory({
      targetCurrency: "USD",
      daysBack: 5,
      mode: "gross",
    });

    expect(toDateKeyList(result)).toEqual([
      { date: "2026-01-01", value: 0 },
      { date: "2026-01-02", value: 0 },
      { date: "2026-01-03", value: 240 },
      { date: "2026-01-04", value: 220 },
      { date: "2026-01-05", value: 220 },
    ]);
  });

  it("preserves after-tax basis fallback semantics with market overrides", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub({
        positions: [
          {
            id: "pos-1",
            currency: "USD",
            symbol_id: "sym-1",
            domain_id: null,
            user_id: "user-1",
            type: "asset",
            capital_gains_tax_rate: 0.2,
          },
        ],
        snapshots: [
          {
            id: "snap-1",
            position_id: "pos-1",
            date: "2026-01-03",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-03T10:00:00.000Z",
            cost_basis_per_unit: null,
          },
          {
            id: "snap-2",
            position_id: "pos-1",
            date: "2026-01-04",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-04T10:00:00.000Z",
            cost_basis_per_unit: null,
          },
        ],
      }),
    });

    fetchMarketDataRangeMock.mockResolvedValue(
      new Map([["pos-1|2026-01-04", 150]]),
    );

    const { fetchNetWorthHistory } = await import("./net-worth-history");
    const result = await fetchNetWorthHistory({
      targetCurrency: "USD",
      daysBack: 3,
      mode: "after_capital_gains",
    });

    expect(toDateKeyList(result)).toEqual([
      { date: "2026-01-03", value: 100 },
      { date: "2026-01-04", value: 140 },
      { date: "2026-01-05", value: 100 },
    ]);
  });
});
