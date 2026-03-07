import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const getOptionalUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
  getOptionalUser: getOptionalUserMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

type ProfileRow = {
  user_id: string;
  time_zone: string;
  time_zone_mode: "auto" | "manual";
};

type QueryError = {
  code?: string;
  message: string;
};

type FakeState = {
  profile: ProfileRow;
  updateError: QueryError | null;
  updatePayloads: Array<Record<string, unknown>>;
};

class FakeProfilesUpdateQuery {
  private updatePayload: Record<string, unknown> | null = null;
  private userIdFilter: string | null = null;
  private timeZoneModeFilter: string | null = null;
  private notEqualTimeZoneFilter: string | null = null;

  constructor(private readonly state: FakeState) {}

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: string) {
    if (column === "user_id") {
      this.userIdFilter = value;
    }

    if (column === "time_zone_mode") {
      this.timeZoneModeFilter = value;
    }

    return this;
  }

  neq(column: string, value: string) {
    if (column === "time_zone") {
      this.notEqualTimeZoneFilter = value;
    }

    return this;
  }

  async select() {
    if (this.state.updateError) {
      return { data: null, error: this.state.updateError };
    }

    const profileMatches =
      this.state.profile.user_id === this.userIdFilter &&
      this.state.profile.time_zone_mode === this.timeZoneModeFilter &&
      this.state.profile.time_zone !== this.notEqualTimeZoneFilter;

    if (!profileMatches || !this.updatePayload) {
      return { data: [], error: null };
    }

    this.state.updatePayloads.push(this.updatePayload);
    this.state.profile = {
      ...this.state.profile,
      ...(this.updatePayload as Partial<ProfileRow>),
    };

    return {
      data: [{ user_id: this.state.profile.user_id }],
      error: null,
    };
  }
}

function createSupabaseStub(state: FakeState) {
  return {
    from: (table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      return new FakeProfilesUpdateQuery(state);
    },
  };
}

function createState(overrides?: Partial<ProfileRow>): FakeState {
  return {
    profile: {
      user_id: "user-1",
      time_zone: "UTC",
      time_zone_mode: "auto",
      ...overrides,
    },
    updateError: null,
    updatePayloads: [],
  };
}

describe("syncProfileTimeZone", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getOptionalUserMock.mockReset();
    revalidatePathMock.mockReset();
    vi.resetModules();
  });

  it("updates auto-mode profiles and revalidates the dashboard layout", async () => {
    const state = createState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { syncProfileTimeZone } = await import("./actions");
    const result = await syncProfileTimeZone("Asia/Seoul");

    expect(result).toEqual({
      success: true,
      changed: true,
      reason: "auto_follow",
    });
    expect(state.updatePayloads).toEqual([{ time_zone: "Asia/Seoul" }]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("keeps manual-mode profiles unchanged", async () => {
    const state = createState({
      time_zone: "America/New_York",
      time_zone_mode: "manual",
    });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { syncProfileTimeZone } = await import("./actions");
    const result = await syncProfileTimeZone("Asia/Seoul");

    expect(result).toEqual({
      success: true,
      changed: false,
      reason: "noop",
    });
    expect(state.updatePayloads).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects invalid browser timezones", async () => {
    const state = createState();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { syncProfileTimeZone } = await import("./actions");
    const result = await syncProfileTimeZone("Not/A-Real-Time-Zone");

    expect(result).toEqual({
      success: false,
      changed: false,
      code: "INVALID_TIME_ZONE",
      message: "Invalid timezone. Please select a valid IANA timezone.",
    });
    expect(state.updatePayloads).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
