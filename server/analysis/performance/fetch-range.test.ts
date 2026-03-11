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
  private readonly filters = {
    eq: new Map<string, unknown>(),
    not: new Map<string, unknown>(),
    in: new Map<string, unknown[]>(),
    lte: new Map<string, unknown>(),
    gte: new Map<string, unknown>(),
    limit: null as number | null,
  };

  constructor(
    private readonly table: string,
    private readonly rowsByTable: Record<string, Record<string, unknown>[]>,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.eq.set(column, value);
    return this;
  }

  not(column: string, _operator: string, value: unknown) {
    this.filters.not.set(column, value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.in.set(column, values);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.lte.set(column, value);
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.gte.set(column, value);
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.filters.limit = value;
    return this;
  }

  then<TResult1 = FakeQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    let rows = [...(this.rowsByTable[this.table] ?? [])];

    this.filters.eq.forEach((value, column) => {
      rows = rows.filter((row) => row[column] === value);
    });

    this.filters.not.forEach((value, column) => {
      rows = rows.filter((row) => row[column] !== value);
    });

    this.filters.in.forEach((values, column) => {
      rows = rows.filter((row) => values.includes(row[column]));
    });

    this.filters.lte.forEach((value, column) => {
      rows = rows.filter((row) => String(row[column]) <= String(value));
    });

    this.filters.gte.forEach((value, column) => {
      rows = rows.filter((row) => String(row[column]) >= String(value));
    });

    if (this.filters.limit != null) {
      rows = rows.slice(0, this.filters.limit);
    }

    return Promise.resolve({ data: rows, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function createSupabaseStub(
  rowsByTable: Record<string, Record<string, unknown>[]>,
) {
  return {
    from: (table: string) => new FakeSupabaseQuery(table, rowsByTable),
  };
}

describe("fetchPortfolioPerformanceRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T12:00:00.000Z"));

    getCurrentUserMock.mockReset();
    fetchProfileMock.mockReset();
    fetchExchangeRatesMock.mockReset();
    fetchMarketDataRangeMock.mockReset();
    toMarketDataPositionsMock.mockReset();

    fetchProfileMock.mockResolvedValue({
      profile: { display_currency: "USD", time_zone: "UTC" },
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

  it("excludes non-symbol positions and nets same-day buy/sell flows at the portfolio level", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub({
        positions: [
          {
            id: "pos-1",
            user_id: "user-1",
            type: "asset",
            currency: "USD",
            symbol_id: "sym-1",
          },
          {
            id: "pos-2",
            user_id: "user-1",
            type: "asset",
            currency: "USD",
            symbol_id: "sym-2",
          },
          {
            id: "cash-1",
            user_id: "user-1",
            type: "asset",
            currency: "USD",
            symbol_id: null,
          },
        ],
        position_snapshots: [
          {
            id: "snap-1a",
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-01",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-01T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "snap-1b",
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 2,
            unit_value: 100,
            created_at: "2026-01-02T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "snap-1c",
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-03",
            quantity: 2,
            unit_value: 100,
            created_at: "2026-01-03T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "snap-2a",
            position_id: "pos-2",
            user_id: "user-1",
            date: "2026-01-01",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-01T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "snap-2b",
            position_id: "pos-2",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 0,
            unit_value: 100,
            created_at: "2026-01-02T09:30:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "cash-snap-1",
            position_id: "cash-1",
            user_id: "user-1",
            date: "2026-01-01",
            quantity: 1000,
            unit_value: 1,
            created_at: "2026-01-01T09:00:00.000Z",
            cost_basis_per_unit: 1,
          },
        ],
        portfolio_records: [
          {
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 1,
            unit_value: 100,
            type: "buy",
          },
          {
            position_id: "pos-2",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 1,
            unit_value: 100,
            type: "sell",
          },
        ],
      }),
    });

    fetchMarketDataRangeMock.mockResolvedValue(
      new Map([
        ["pos-1|2026-01-01", 100],
        ["pos-1|2026-01-02", 110],
        ["pos-1|2026-01-03", 120],
        ["pos-2|2026-01-01", 100],
      ]),
    );

    const { fetchPortfolioPerformanceRange } = await import("./fetch-range");
    const result = await fetchPortfolioPerformanceRange({
      targetCurrency: "USD",
      daysBack: 3,
      methodology: "time_weighted_return",
      scope: "symbol_assets",
    });

    expect(result.isAvailable).toBe(true);
    if (!result.isAvailable) {
      throw new Error("expected available performance range");
    }

    expect(result.history).toHaveLength(3);
    expect(result.history[0].cumulativeReturnPct).toBe(0);
    expect(result.history[1].cumulativeReturnPct).toBeCloseTo(10, 10);
    expect(result.history[2].cumulativeReturnPct).toBeCloseTo(20, 10);
  });

  it("returns an unavailable state when the selected range contains update records", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub({
        positions: [
          {
            id: "pos-1",
            user_id: "user-1",
            type: "asset",
            currency: "USD",
            symbol_id: "sym-1",
          },
        ],
        position_snapshots: [
          {
            id: "snap-1a",
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-01",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-01T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
          {
            id: "snap-1b",
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 1,
            unit_value: 100,
            created_at: "2026-01-02T09:00:00.000Z",
            cost_basis_per_unit: 100,
          },
        ],
        portfolio_records: [
          {
            position_id: "pos-1",
            user_id: "user-1",
            date: "2026-01-02",
            quantity: 1,
            unit_value: 100,
            type: "update",
          },
        ],
      }),
    });

    const { fetchPortfolioPerformanceRange } = await import("./fetch-range");
    const result = await fetchPortfolioPerformanceRange({
      targetCurrency: "USD",
      daysBack: 3,
      methodology: "time_weighted_return",
      scope: "symbol_assets",
    });

    expect(result).toMatchObject({
      isAvailable: false,
      unavailableReason: "unsupported_update_records",
    });
  });
});
