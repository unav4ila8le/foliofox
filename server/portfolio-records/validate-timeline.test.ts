import { describe, expect, it, vi } from "vitest";

import {
  validatePortfolioRecordTimelineWindow,
  validateRecordQuantityByType,
} from "./validate-timeline";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type SnapshotRow = {
  quantity: number;
  portfolio_record_id: string | null;
};

function createSupabaseSnapshotStub(
  options: {
    data?: SnapshotRow[];
    error?: { code?: string; message?: string } | null;
  } = {},
) {
  const response = {
    data: options.data ?? [],
    error: options.error ?? null,
  };

  let capturedOrFilter: string | null = null;

  const queryBuilder: {
    eq: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    then: PromiseLike<typeof response>["then"];
  } = {
    eq: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(response).then(onfulfilled, onrejected),
  };

  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.lte.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.limit.mockReturnValue(queryBuilder);
  queryBuilder.or.mockImplementation((filter: string) => {
    capturedOrFilter = filter;
    return queryBuilder;
  });

  const supabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(queryBuilder),
    }),
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    getCapturedOrFilter: () => capturedOrFilter,
  };
}

describe("validateRecordQuantityByType", () => {
  it("accepts valid quantities for buy, sell, and update", () => {
    expect(validateRecordQuantityByType({ type: "buy", quantity: 1 })).toEqual({
      valid: true,
    });
    expect(
      validateRecordQuantityByType({ type: "sell", quantity: 0.5 }),
    ).toEqual({
      valid: true,
    });
    expect(
      validateRecordQuantityByType({ type: "update", quantity: 0 }),
    ).toEqual({
      valid: true,
    });
  });

  it("rejects non-finite quantities", () => {
    const result = validateRecordQuantityByType({
      type: "buy",
      quantity: Number.NaN,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("INVALID_QUANTITY");
    }
  });

  it("rejects non-positive sell quantities", () => {
    const result = validateRecordQuantityByType({
      type: "sell",
      quantity: 0,
      sourceLabel: "Row 2",
    });

    expect(result).toEqual({
      valid: false,
      code: "INVALID_QUANTITY",
      message: "Row 2: Sell quantity must be greater than 0.",
    });
  });
});

describe("validatePortfolioRecordTimelineWindow", () => {
  it("returns valid for an empty record window", async () => {
    const { supabase } = createSupabaseSnapshotStub();

    const result = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: "user-1",
      positionId: "position-1",
      records: [],
    });

    expect(result).toEqual({ valid: true });
  });

  it("rejects oversell with row context", async () => {
    const { supabase, getCapturedOrFilter } = createSupabaseSnapshotStub({
      data: [{ quantity: 21, portfolio_record_id: null }],
    });

    const result = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: "user-1",
      positionId: "position-1",
      records: [
        {
          id: "record-1",
          position_id: "position-1",
          type: "sell",
          date: "2026-01-15",
          quantity: 22,
          sourceLabel: "Row 2",
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      code: "INSUFFICIENT_QUANTITY",
      message: "Row 2: Cannot sell more than 21 units on 2026-01-15.",
    });
    expect(getCapturedOrFilter()).toContain("portfolio_record_id.is.null");
  });

  it("handles update reset before later sells", async () => {
    const { supabase } = createSupabaseSnapshotStub({
      data: [{ quantity: 0, portfolio_record_id: null }],
    });

    const result = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: "user-1",
      positionId: "position-1",
      records: [
        {
          id: "update-1",
          position_id: "position-1",
          type: "update",
          date: "2026-01-01",
          quantity: 21,
          created_at: "2026-01-01T10:00:00.000Z",
        },
        {
          id: "sell-1",
          position_id: "position-1",
          type: "sell",
          date: "2026-01-30",
          quantity: 11,
          created_at: "2026-01-30T10:00:00.000Z",
        },
        {
          id: "sell-2",
          position_id: "position-1",
          type: "sell",
          date: "2026-02-01",
          quantity: 2,
          created_at: "2026-02-01T10:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual({ valid: true });
  });

  it("respects same-day created_at ordering", async () => {
    const { supabase } = createSupabaseSnapshotStub({
      data: [{ quantity: 0, portfolio_record_id: null }],
    });

    const result = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: "user-1",
      positionId: "position-1",
      records: [
        {
          id: "sell-early",
          position_id: "position-1",
          type: "sell",
          date: "2026-01-15",
          quantity: 5,
          created_at: "2026-01-15T09:00:00.000Z",
        },
        {
          id: "buy-late",
          position_id: "position-1",
          type: "buy",
          date: "2026-01-15",
          quantity: 10,
          created_at: "2026-01-15T10:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      code: "INSUFFICIENT_QUANTITY",
      message: "Cannot sell more than 0 units on 2026-01-15.",
    });
  });

  it("returns snapshot fetch failure details", async () => {
    const { supabase } = createSupabaseSnapshotStub({
      error: { code: "PGRST123", message: "query failed" },
    });

    const result = await validatePortfolioRecordTimelineWindow({
      supabase,
      userId: "user-1",
      positionId: "position-1",
      records: [
        {
          id: "buy-1",
          position_id: "position-1",
          type: "buy",
          date: "2026-01-15",
          quantity: 1,
        },
      ],
    });

    expect(result).toEqual({
      valid: false,
      code: "PGRST123",
      message: "query failed",
    });
  });
});
