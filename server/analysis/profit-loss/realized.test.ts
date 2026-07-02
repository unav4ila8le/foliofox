import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

import {
  calculatePositionRealizedProfitLoss,
  calculateRealizedProfitLossByPositionIds,
} from "./realized";

type PortfolioRecordRow = {
  user_id: string;
  position_id: string;
  type: "buy" | "sell" | "update";
  quantity: number;
  unit_value: number;
  position_snapshots:
    | { cost_basis_per_unit: number | null }
    | Array<{ cost_basis_per_unit: number | null }>
    | null;
};

class FakePortfolioRecordsQuery {
  private userIdFilter: string | null = null;
  private typeFilter: PortfolioRecordRow["type"] | null = null;
  private positionIdFilter: string[] | null = null;

  constructor(private readonly rows: PortfolioRecordRow[]) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    if (column === "user_id") {
      this.userIdFilter = String(value);
    }

    if (column === "type") {
      this.typeFilter = value as PortfolioRecordRow["type"];
    }

    return this;
  }

  in(column: string, values: unknown[]) {
    if (column === "position_id") {
      this.positionIdFilter = values.map((value) => String(value));
    }

    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      ((value: { data: PortfolioRecordRow[]; error: null }) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const filteredRows = this.rows.filter((row) => {
      if (this.userIdFilter && row.user_id !== this.userIdFilter) {
        return false;
      }

      if (this.typeFilter && row.type !== this.typeFilter) {
        return false;
      }

      if (
        this.positionIdFilter &&
        !this.positionIdFilter.includes(row.position_id)
      ) {
        return false;
      }

      return true;
    });

    return Promise.resolve({
      data: filteredRows,
      error: null,
    }).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function createSupabaseStub(rows: PortfolioRecordRow[]) {
  return {
    from: (table: string) => {
      if (table !== "portfolio_records") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      return new FakePortfolioRecordsQuery(rows);
    },
  };
}

function createSellRecord(
  overrides: Partial<PortfolioRecordRow> = {},
): PortfolioRecordRow {
  return {
    user_id: "user-1",
    position_id: "pos-1",
    type: "sell",
    quantity: 1,
    unit_value: 100,
    position_snapshots: [{ cost_basis_per_unit: 90 }],
    ...overrides,
  };
}

describe("calculatePositionRealizedProfitLoss", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
  });

  it("returns 0 when there are no sell records", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub([]),
    });

    const result = await calculatePositionRealizedProfitLoss("pos-1");

    expect(result).toEqual({ realized: { amount: 0 } });
  });

  it("calculates realized profit for a partial sell using weighted-average basis", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub([
        createSellRecord({
          quantity: 50,
          unit_value: 120,
          position_snapshots: [{ cost_basis_per_unit: 90 }],
        }),
      ]),
    });

    const result = await calculatePositionRealizedProfitLoss("pos-1");

    expect(result).toEqual({ realized: { amount: 1500 } });
  });

  it("aggregates multiple sell records across requested positions", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub([
        createSellRecord({
          position_id: "pos-1",
          quantity: 2,
          unit_value: 110,
          position_snapshots: [{ cost_basis_per_unit: 80 }],
        }),
        createSellRecord({
          position_id: "pos-1",
          quantity: 1,
          unit_value: 95,
          position_snapshots: [{ cost_basis_per_unit: 80 }],
        }),
        createSellRecord({
          position_id: "pos-2",
          quantity: 3,
          unit_value: 75,
          position_snapshots: [{ cost_basis_per_unit: 70 }],
        }),
      ]),
    });

    const result = await calculateRealizedProfitLossByPositionIds([
      "pos-1",
      "pos-2",
    ]);

    expect(result.get("pos-1")).toBe(75);
    expect(result.get("pos-2")).toBe(15);
  });

  it("ignores buy and update records", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub([
        createSellRecord({
          type: "buy",
          quantity: 10,
          unit_value: 90,
          position_snapshots: [{ cost_basis_per_unit: 90 }],
        }),
        createSellRecord({
          type: "update",
          quantity: 15,
          unit_value: 100,
          position_snapshots: [{ cost_basis_per_unit: 100 }],
        }),
        createSellRecord({
          type: "sell",
          quantity: 5,
          unit_value: 120,
          position_snapshots: [{ cost_basis_per_unit: 100 }],
        }),
      ]),
    });

    const result = await calculatePositionRealizedProfitLoss("pos-1");

    expect(result).toEqual({ realized: { amount: 100 } });
  });
});
