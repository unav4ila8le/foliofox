import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

type ScenarioRow = {
  id: string;
  user_id: string;
  settings: unknown;
  initial_value: number;
  initial_value_basis: "net_worth" | "cash" | "manual";
};

type ProfileRow = {
  display_currency: string;
  time_zone: string;
};

type QueryError = {
  code?: string;
  message: string;
};

interface FakeState {
  scenarioRow: ScenarioRow | null;
  profileRow: ProfileRow | null;
  scenarioSelectError: QueryError | null;
  profileSelectError: QueryError | null;
  updateError: QueryError | null;
  profileSelectCalls: number;
  financialScenarioUpdatePayloads: Array<Record<string, unknown>>;
}

const pickSelectedColumns = (
  row: Record<string, unknown>,
  selectedColumns: string | null,
): Record<string, unknown> => {
  if (!selectedColumns || selectedColumns === "*") {
    return { ...row };
  }

  const selected = selectedColumns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  return selected.reduce<Record<string, unknown>>((accumulator, column) => {
    accumulator[column] = row[column];
    return accumulator;
  }, {});
};

class FakeQuery {
  private selectedColumns: string | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly table: "financial_scenarios" | "profiles",
    private readonly state: FakeState,
  ) {}

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  async single() {
    return this.executeSelectSingle();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: QueryError | null }) => TResult1)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  private executeSelectSingle() {
    if (this.table === "financial_scenarios") {
      if (this.state.scenarioSelectError) {
        return { data: null, error: this.state.scenarioSelectError };
      }

      const row = this.state.scenarioRow;
      if (!row || !this.matchesRow(row)) {
        return {
          data: null,
          error: { code: "NOT_FOUND", message: "Scenario not found" },
        };
      }

      return {
        data: pickSelectedColumns(row, this.selectedColumns),
        error: null,
      };
    }

    this.state.profileSelectCalls += 1;
    if (this.state.profileSelectError) {
      return { data: null, error: this.state.profileSelectError };
    }

    const row = this.state.profileRow;
    if (!row || !this.matchesRow({ ...row, user_id: "user-1" })) {
      return {
        data: null,
        error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
      };
    }

    return {
      data: pickSelectedColumns(
        row as unknown as Record<string, unknown>,
        this.selectedColumns,
      ),
      error: null,
    };
  }

  private execute() {
    if (this.table !== "financial_scenarios" || !this.updatePayload) {
      return {
        data: null,
        error: { code: "INVALID_OPERATION", message: "Invalid operation" },
      };
    }

    const row = this.state.scenarioRow;
    if (!row || !this.matchesRow(row)) {
      return {
        data: null,
        error: { code: "NOT_FOUND", message: "Scenario not found" },
      };
    }

    if (this.state.updateError) {
      return { data: null, error: this.state.updateError };
    }

    this.state.financialScenarioUpdatePayloads.push(this.updatePayload);
    this.state.scenarioRow = {
      ...row,
      ...(this.updatePayload as Partial<ScenarioRow>),
    };

    return { data: null, error: null };
  }

  private matchesRow(row: Record<string, unknown>) {
    return this.filters.every((filter) => row[filter.column] === filter.value);
  }
}

const createSupabaseStub = (state: FakeState) => ({
  from: (table: "financial_scenarios" | "profiles") => {
    return new FakeQuery(table, state);
  },
});

const createDefaultState = (): FakeState => ({
  scenarioRow: {
    id: "scenario-1",
    user_id: "user-1",
    initial_value: 1000,
    initial_value_basis: "manual",
    settings: {
      assumptions: {
        preset: "average",
        values: {
          expectedAnnualReturnPercent: 7,
          inflationAnnualPercent: 2.5,
          volatilityAnnualPercent: 15,
        },
      },
      customFlag: true,
      baseline: {
        sourceCurrency: "EUR",
        sourceMode: "cash",
        sourceAsOfDateKey: "2026-03-03",
      },
    },
  },
  profileRow: {
    display_currency: "USD",
    time_zone: "UTC",
  },
  scenarioSelectError: null,
  profileSelectError: null,
  updateError: null,
  profileSelectCalls: 0,
  financialScenarioUpdatePayloads: [],
});

describe("financial scenario upsert actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00.000Z"));
    getCurrentUserMock.mockReset();
    revalidatePathMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists assumptions and preserves unknown settings keys", async () => {
    const state = createDefaultState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { updateScenarioAssumptions } = await import("./upsert");

    const assumptions = {
      preset: "negative" as const,
      values: {
        expectedAnnualReturnPercent: 1.5,
        inflationAnnualPercent: 4,
        volatilityAnnualPercent: 22,
      },
    };

    const result = await updateScenarioAssumptions("scenario-1", assumptions);

    expect(result).toEqual({ success: true });
    expect(state.financialScenarioUpdatePayloads).toHaveLength(1);
    expect(state.financialScenarioUpdatePayloads[0]).toEqual({
      settings: {
        assumptions,
        customFlag: true,
        baseline: {
          sourceCurrency: "EUR",
          sourceMode: "cash",
          sourceAsOfDateKey: "2026-03-03",
        },
      },
    });
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      1,
      "/dashboard/planning",
      "layout",
    );
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      2,
      "/dashboard/planning/scenario",
    );
  });

  it("returns validation error for malformed assumptions payload", async () => {
    const state = createDefaultState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { updateScenarioAssumptions } = await import("./upsert");

    const result = await updateScenarioAssumptions("scenario-1", {
      preset: "invalid",
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_SCENARIO_ASSUMPTIONS");
    expect(state.financialScenarioUpdatePayloads).toHaveLength(0);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("writes baseline metadata when syncing non-manual basis", async () => {
    const state = createDefaultState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { updateScenarioInitialValue } = await import("./upsert");

    const result = await updateScenarioInitialValue("scenario-1", 12345.67, {
      initialValueBasis: "net_worth",
    });

    expect(result).toEqual({ success: true });
    expect(state.financialScenarioUpdatePayloads).toHaveLength(1);
    expect(state.financialScenarioUpdatePayloads[0]).toEqual({
      initial_value: 12345.67,
      initial_value_basis: "net_worth",
      settings: {
        assumptions: {
          preset: "average",
          values: {
            expectedAnnualReturnPercent: 7,
            inflationAnnualPercent: 2.5,
            volatilityAnnualPercent: 15,
          },
        },
        customFlag: true,
        baseline: {
          sourceCurrency: "USD",
          sourceMode: "net_worth",
          sourceAsOfDateKey: "2026-03-04",
        },
      },
    });
    expect(state.profileSelectCalls).toBe(1);
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      1,
      "/dashboard/planning",
      "layout",
    );
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      2,
      "/dashboard/planning/scenario",
    );
  });

  it("clears baseline metadata when basis is manual", async () => {
    const state = createDefaultState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { updateScenarioInitialValue } = await import("./upsert");

    const result = await updateScenarioInitialValue("scenario-1", 9999, {
      initialValueBasis: "manual",
    });

    expect(result).toEqual({ success: true });
    expect(state.financialScenarioUpdatePayloads).toHaveLength(1);
    expect(state.financialScenarioUpdatePayloads[0]).toEqual({
      initial_value: 9999,
      initial_value_basis: "manual",
      settings: {
        assumptions: {
          preset: "average",
          values: {
            expectedAnnualReturnPercent: 7,
            inflationAnnualPercent: 2.5,
            volatilityAnnualPercent: 15,
          },
        },
        customFlag: true,
      },
    });
    expect(state.profileSelectCalls).toBe(0);
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      1,
      "/dashboard/planning",
      "layout",
    );
    expect(revalidatePathMock).toHaveBeenNthCalledWith(
      2,
      "/dashboard/planning/scenario",
    );
  });
});
