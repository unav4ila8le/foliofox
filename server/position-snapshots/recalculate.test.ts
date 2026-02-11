import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

import {
  applyPortfolioRecordTransition,
  recalculateSnapshotsUntilNextUpdate,
} from "./recalculate";

import type { PortfolioRecord } from "@/types/global.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type PortfolioRecordRow = Pick<
  PortfolioRecord,
  | "id"
  | "user_id"
  | "position_id"
  | "type"
  | "date"
  | "quantity"
  | "unit_value"
  | "created_at"
>;

type PositionSnapshotRow = {
  id?: string;
  user_id: string;
  position_id: string;
  date: string;
  quantity: number;
  unit_value: number;
  cost_basis_per_unit: number | null;
  portfolio_record_id: string | null;
  created_at: string;
};

type SupportedTable = "portfolio_records" | "position_snapshots";

type Filter = {
  column: string;
  operator: "eq" | "in" | "gte" | "gt" | "lte" | "lt";
  value: unknown;
};

function toComparableValue(value: unknown): string | number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

class FakeRecalculateQuery<
  T extends Record<string, unknown>,
  TTableName extends SupportedTable,
> {
  private operation: "select" | "delete" = "select";
  private filters: Filter[] = [];
  private ordering: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | null = null;

  constructor(
    private readonly tableName: TTableName,
    private readonly fakeSupabase: FakeRecalculateSupabase,
  ) {}

  select() {
    this.operation = "select";
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  insert(values: Partial<T> | Array<Partial<T>>) {
    if (this.tableName !== "position_snapshots") {
      throw new Error("Insert is only supported for position_snapshots");
    }

    const rows = Array.isArray(values) ? values : [values];
    const now = Date.now();
    rows.forEach((row, index) => {
      this.fakeSupabase.positionSnapshots.push({
        id: `inserted-${now + index}`,
        user_id: String(row.user_id),
        position_id: String(row.position_id),
        date: String(row.date),
        quantity: Number(row.quantity),
        unit_value: Number(row.unit_value),
        cost_basis_per_unit:
          row.cost_basis_per_unit != null
            ? Number(row.cost_basis_per_unit)
            : null,
        portfolio_record_id:
          row.portfolio_record_id != null
            ? String(row.portfolio_record_id)
            : null,
        created_at: new Date(now + index).toISOString(),
      });
    });

    return Promise.resolve({ data: null, error: null });
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, operator: "in", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.ordering.push({ column, ascending: options.ascending });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    return {
      ...result,
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
    };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: T[] | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  private execute(): Promise<{ data: T[] | null; error: null }> {
    const rows = this.getRows();

    if (this.operation === "delete") {
      this.fakeSupabase.deleteRows(this.tableName, rows);
      return Promise.resolve({ data: null, error: null });
    }

    return Promise.resolve({ data: rows, error: null });
  }

  private getRows() {
    const sourceRows =
      this.tableName === "portfolio_records"
        ? this.fakeSupabase.portfolioRecords
        : this.fakeSupabase.positionSnapshots;

    let rows = sourceRows.filter((row) => {
      return this.filters.every((filter) => {
        const rowValue = row[filter.column as keyof typeof row];

        if (filter.operator === "eq") {
          return rowValue === filter.value;
        }

        if (filter.operator === "in") {
          return (filter.value as unknown[]).includes(rowValue);
        }

        if (filter.operator === "gte") {
          const left = toComparableValue(rowValue);
          const right = toComparableValue(filter.value);
          if (left == null || right == null) {
            return false;
          }
          return left >= right;
        }

        if (filter.operator === "gt") {
          const left = toComparableValue(rowValue);
          const right = toComparableValue(filter.value);
          if (left == null || right == null) {
            return false;
          }
          return left > right;
        }

        if (filter.operator === "lte") {
          const left = toComparableValue(rowValue);
          const right = toComparableValue(filter.value);
          if (left == null || right == null) {
            return false;
          }
          return left <= right;
        }

        const left = toComparableValue(rowValue);
        const right = toComparableValue(filter.value);
        if (left == null || right == null) {
          return false;
        }
        return left < right;
      });
    });

    if (this.ordering.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const clause of this.ordering) {
          const leftValue = left[clause.column as keyof typeof left];
          const rightValue = right[clause.column as keyof typeof right];
          if (leftValue === rightValue) {
            continue;
          }

          const leftComparable = toComparableValue(leftValue);
          const rightComparable = toComparableValue(rightValue);

          if (leftComparable == null) {
            return 1;
          }
          if (rightComparable == null) {
            return -1;
          }

          const compare = leftComparable > rightComparable ? 1 : -1;
          return clause.ascending ? compare : -compare;
        }

        return 0;
      });
    }

    if (this.rowLimit != null) {
      rows = rows.slice(0, this.rowLimit);
    }

    return rows as unknown as T[];
  }
}

class FakeRecalculateSupabase {
  public portfolioRecords: PortfolioRecordRow[];
  public positionSnapshots: PositionSnapshotRow[];

  constructor(options: {
    portfolioRecords?: PortfolioRecordRow[];
    positionSnapshots?: PositionSnapshotRow[];
  }) {
    this.portfolioRecords = [...(options.portfolioRecords ?? [])];
    this.positionSnapshots = [...(options.positionSnapshots ?? [])];
  }

  from(table: SupportedTable) {
    if (table === "portfolio_records") {
      return new FakeRecalculateQuery<PortfolioRecordRow, "portfolio_records">(
        table,
        this,
      );
    }

    return new FakeRecalculateQuery<PositionSnapshotRow, "position_snapshots">(
      table,
      this,
    );
  }

  deleteRows(
    table: SupportedTable,
    matchedRows: Array<Record<string, unknown>>,
  ) {
    const toDelete = new Set(matchedRows);

    if (table === "portfolio_records") {
      this.portfolioRecords = this.portfolioRecords.filter(
        (row) => !toDelete.has(row),
      );
      return;
    }

    this.positionSnapshots = this.positionSnapshots.filter(
      (row) => !toDelete.has(row),
    );
  }
}

function buildRecord(options: {
  type: PortfolioRecord["type"];
  quantity: number;
  unitValue: number;
  id?: string;
}): Pick<PortfolioRecord, "id" | "type" | "quantity" | "unit_value"> {
  return {
    id: options.id ?? "record-1",
    type: options.type,
    quantity: options.quantity,
    unit_value: options.unitValue,
  };
}

describe("applyPortfolioRecordTransition", () => {
  it("applies weighted cost basis for consecutive buys", () => {
    const firstBuy = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "buy", quantity: 10, unitValue: 100 }),
      runningQuantity: 0,
      runningCostBasis: 0,
    });

    const secondBuy = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "buy", quantity: 5, unitValue: 200 }),
      runningQuantity: firstBuy.runningQuantity,
      runningCostBasis: firstBuy.runningCostBasis,
    });

    expect(firstBuy).toEqual({
      runningQuantity: 10,
      runningCostBasis: 100,
    });
    expect(secondBuy.runningQuantity).toBe(15);
    expect(secondBuy.runningCostBasis).toBeCloseTo(133.333333, 6);
  });

  it("decreases quantity on sell and keeps cost basis unchanged", () => {
    const result = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "sell", quantity: 4, unitValue: 150 }),
      runningQuantity: 10,
      runningCostBasis: 120,
    });

    expect(result).toEqual({
      runningQuantity: 6,
      runningCostBasis: 120,
    });
  });

  it("resets quantity and cost basis on update, with optional override", () => {
    const withoutOverride = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "update", quantity: 8, unitValue: 90 }),
      runningQuantity: 10,
      runningCostBasis: 120,
    });

    const withOverride = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "update", quantity: 8, unitValue: 90 }),
      runningQuantity: 10,
      runningCostBasis: 120,
      overrideCostBasisPerUnit: 75,
    });

    expect(withoutOverride).toEqual({
      runningQuantity: 8,
      runningCostBasis: 90,
    });
    expect(withOverride).toEqual({
      runningQuantity: 8,
      runningCostBasis: 75,
    });
  });

  it("clamps oversell quantity to zero", () => {
    const result = applyPortfolioRecordTransition({
      recordItem: buildRecord({ type: "sell", quantity: 12, unitValue: 100 }),
      runningQuantity: 5,
      runningCostBasis: 80,
    });

    expect(result).toEqual({
      runningQuantity: 0,
      runningCostBasis: 80,
    });
  });
});

describe("recalculateSnapshotsUntilNextUpdate", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  // End-to-end-ish test with a fake in-memory Supabase client.
  // We validate only the orchestration contract, not SQL behavior.
  it("recalculates from fromDate and inserts snapshots for records on/after that date", async () => {
    const fakeSupabase = new FakeRecalculateSupabase({
      portfolioRecords: [
        {
          id: "buy-1",
          user_id: "user-1",
          position_id: "position-1",
          type: "buy",
          date: "2026-01-05",
          quantity: 10,
          unit_value: 100,
          created_at: "2026-01-05T10:00:00.000Z",
        },
        {
          id: "sell-1",
          user_id: "user-1",
          position_id: "position-1",
          type: "sell",
          date: "2026-01-10",
          quantity: 4,
          unit_value: 110,
          created_at: "2026-01-10T10:00:00.000Z",
        },
        {
          id: "buy-2",
          user_id: "user-1",
          position_id: "position-1",
          type: "buy",
          date: "2026-01-12",
          quantity: 1,
          unit_value: 120,
          created_at: "2026-01-12T10:00:00.000Z",
        },
      ],
      positionSnapshots: [
        {
          id: "base-1",
          user_id: "user-1",
          position_id: "position-1",
          date: "2026-01-01",
          quantity: 5,
          unit_value: 80,
          cost_basis_per_unit: 80,
          portfolio_record_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    createServiceClientMock.mockResolvedValue(
      fakeSupabase as unknown as SupabaseClient<Database>,
    );

    const result = await recalculateSnapshotsUntilNextUpdate({
      positionId: "position-1",
      fromDate: new Date("2026-01-10"),
    });

    expect(result).toEqual({ success: true });

    const insertedSnapshots = fakeSupabase.positionSnapshots.filter(
      (snapshot) =>
        snapshot.portfolio_record_id === "sell-1" ||
        snapshot.portfolio_record_id === "buy-2",
    );

    expect(insertedSnapshots).toHaveLength(2);
    expect(
      insertedSnapshots.find(
        (snapshot) => snapshot.portfolio_record_id === "sell-1",
      )?.quantity,
    ).toBe(11);
    expect(
      insertedSnapshots.find(
        (snapshot) => snapshot.portfolio_record_id === "buy-2",
      )?.quantity,
    ).toBe(12);
  });

  it("stops recalculation at next update boundary (exclusive)", async () => {
    const fakeSupabase = new FakeRecalculateSupabase({
      portfolioRecords: [
        {
          id: "buy-before-update",
          user_id: "user-1",
          position_id: "position-1",
          type: "buy",
          date: "2026-01-10",
          quantity: 10,
          unit_value: 100,
          created_at: "2026-01-10T10:00:00.000Z",
        },
        {
          id: "update-boundary",
          user_id: "user-1",
          position_id: "position-1",
          type: "update",
          date: "2026-01-20",
          quantity: 7,
          unit_value: 150,
          created_at: "2026-01-20T10:00:00.000Z",
        },
        {
          id: "sell-after-update",
          user_id: "user-1",
          position_id: "position-1",
          type: "sell",
          date: "2026-01-25",
          quantity: 2,
          unit_value: 160,
          created_at: "2026-01-25T10:00:00.000Z",
        },
      ],
      positionSnapshots: [],
    });

    createServiceClientMock.mockResolvedValue(
      fakeSupabase as unknown as SupabaseClient<Database>,
    );

    const result = await recalculateSnapshotsUntilNextUpdate({
      positionId: "position-1",
      fromDate: new Date("2026-01-01"),
    });

    expect(result).toEqual({ success: true });

    const processedRecordIds = fakeSupabase.positionSnapshots
      .map((snapshot) => snapshot.portfolio_record_id)
      .filter((id): id is string => Boolean(id));

    expect(processedRecordIds).toContain("buy-before-update");
    expect(processedRecordIds).not.toContain("update-boundary");
    expect(processedRecordIds).not.toContain("sell-after-update");
  });

  it("uses custom cost basis override for update records", async () => {
    const fakeSupabase = new FakeRecalculateSupabase({
      portfolioRecords: [
        {
          id: "update-1",
          user_id: "user-1",
          position_id: "position-1",
          type: "update",
          date: "2026-01-15",
          quantity: 8,
          unit_value: 100,
          created_at: "2026-01-15T10:00:00.000Z",
        },
      ],
      positionSnapshots: [],
    });

    createServiceClientMock.mockResolvedValue(
      fakeSupabase as unknown as SupabaseClient<Database>,
    );

    const result = await recalculateSnapshotsUntilNextUpdate({
      positionId: "position-1",
      fromDate: new Date("2026-01-15"),
      customCostBasisByRecordId: {
        "update-1": 70,
      },
    });

    expect(result).toEqual({ success: true });

    const updateSnapshot = fakeSupabase.positionSnapshots.find(
      (snapshot) => snapshot.portfolio_record_id === "update-1",
    );

    expect(updateSnapshot?.quantity).toBe(8);
    expect(updateSnapshot?.cost_basis_per_unit).toBe(70);
  });
});
