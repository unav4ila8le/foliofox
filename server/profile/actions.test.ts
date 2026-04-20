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
  last_app_activity_at?: string | null;
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
      last_app_activity_at: null,
      ...overrides,
    },
    updateError: null,
    updatePayloads: [],
  };
}

type ActivityProfileRow = Pick<ProfileRow, "user_id" | "last_app_activity_at">;

type ActivityState = {
  profile: ActivityProfileRow | null;
  selectError: QueryError | null;
  updateError: QueryError | null;
  updatePayloads: Array<Record<string, unknown>>;
};

class FakeLastAppActivityQuery {
  private mode: "idle" | "select" | "update" = "idle";
  private updatePayload: Record<string, unknown> | null = null;
  private userIdFilter: string | null = null;

  constructor(private readonly state: ActivityState) {}

  select() {
    this.mode = "select";
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.mode = "update";
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: string) {
    if (column === "user_id") {
      this.userIdFilter = value;
    }

    if (this.mode === "update") {
      return Promise.resolve(this.runUpdate());
    }

    return this;
  }

  async single() {
    if (this.mode !== "select") {
      return { data: null, error: { message: "Unexpected single() call" } };
    }

    if (this.state.selectError) {
      return { data: null, error: this.state.selectError };
    }

    if (
      !this.state.profile ||
      !this.userIdFilter ||
      this.state.profile.user_id !== this.userIdFilter
    ) {
      return { data: null, error: { message: "Profile not found" } };
    }

    return {
      data: {
        last_app_activity_at: this.state.profile.last_app_activity_at ?? null,
      },
      error: null,
    };
  }

  private runUpdate() {
    if (this.state.updateError) {
      return { error: this.state.updateError };
    }

    if (
      !this.state.profile ||
      !this.userIdFilter ||
      this.state.profile.user_id !== this.userIdFilter ||
      !this.updatePayload
    ) {
      return { error: { message: "Unexpected update() call" } };
    }

    this.state.updatePayloads.push(this.updatePayload);
    this.state.profile = {
      ...this.state.profile,
      ...(this.updatePayload as Partial<ActivityProfileRow>),
    };

    return { error: null };
  }
}

function createLastAppActivityState(
  overrides?: Partial<ActivityProfileRow>,
): ActivityState {
  return {
    profile: {
      user_id: "user-1",
      last_app_activity_at: null,
      ...overrides,
    },
    selectError: null,
    updateError: null,
    updatePayloads: [],
  };
}

function createLastAppActivitySupabaseStub(state: ActivityState) {
  return {
    from: (table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      return new FakeLastAppActivityQuery(state);
    },
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

describe("touchLastAppActivity", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getOptionalUserMock.mockReset();
    revalidatePathMock.mockReset();
    vi.resetModules();
    vi.useRealTimers();
  });

  it("updates a stale activity timestamp without revalidating the dashboard", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    const state = createLastAppActivityState({
      last_app_activity_at: "2026-04-17T02:00:00.000Z",
    });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createLastAppActivitySupabaseStub(state),
    });

    const { touchLastAppActivity } = await import("./actions");
    const result = await touchLastAppActivity();

    expect(result).toEqual({
      success: true,
      changed: true,
      reason: "updated",
      lastAppActivityAt: "2026-04-17T12:00:00.000Z",
    });
    expect(state.updatePayloads).toEqual([
      { last_app_activity_at: "2026-04-17T12:00:00.000Z" },
    ]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("skips writes when the stored activity timestamp is still within cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    const state = createLastAppActivityState({
      last_app_activity_at: "2026-04-17T09:00:00.000Z",
    });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createLastAppActivitySupabaseStub(state),
    });

    const { touchLastAppActivity } = await import("./actions");
    const result = await touchLastAppActivity();

    expect(result).toEqual({
      success: true,
      changed: false,
      reason: "cooldown",
      lastAppActivityAt: "2026-04-17T09:00:00.000Z",
    });
    expect(state.updatePayloads).toEqual([]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
