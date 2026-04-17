import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

type EmailPreferencesRow = {
  user_id: string;
  weekly_recap_enabled: boolean;
  marketing_emails_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type FakeEmailPreferencesState = {
  row: EmailPreferencesRow | null;
  updatePayloads: Array<Record<string, unknown>>;
};

class FakeEmailPreferencesQuery {
  private selectCalled = false;
  private insertPayload: { user_id: string } | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private userIdFilter: string | null = null;

  constructor(private readonly state: FakeEmailPreferencesState) {}

  select() {
    this.selectCalled = true;
    return this;
  }

  insert(payload: { user_id: string }) {
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  eq(column: string, value: string) {
    if (column === "user_id") {
      this.userIdFilter = value;
    }

    return this;
  }

  async maybeSingle() {
    if (
      this.selectCalled &&
      this.userIdFilter &&
      this.state.row?.user_id === this.userIdFilter
    ) {
      return { data: this.state.row, error: null };
    }

    return { data: null, error: null };
  }

  async single() {
    if (this.insertPayload) {
      const nextRow: EmailPreferencesRow = {
        user_id: this.insertPayload.user_id,
        weekly_recap_enabled: true,
        marketing_emails_enabled: true,
        created_at: "2026-04-17T00:00:00.000Z",
        updated_at: "2026-04-17T00:00:00.000Z",
      };
      this.state.row = nextRow;
      return { data: nextRow, error: null };
    }

    if (
      this.updatePayload &&
      this.userIdFilter &&
      this.state.row?.user_id === this.userIdFilter
    ) {
      const updatedRow: EmailPreferencesRow = {
        ...this.state.row,
        ...(this.updatePayload as Partial<EmailPreferencesRow>),
      };
      this.state.row = updatedRow;
      this.state.updatePayloads.push(this.updatePayload);
      return { data: updatedRow, error: null };
    }

    return { data: null, error: { message: "Unexpected single() call" } };
  }
}

function createSupabaseStub(state: FakeEmailPreferencesState) {
  return {
    from: (table: string) => {
      if (table !== "email_preferences") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      return new FakeEmailPreferencesQuery(state);
    },
  };
}

function createState(
  row: EmailPreferencesRow | null,
): FakeEmailPreferencesState {
  return {
    row,
    updatePayloads: [],
  };
}

describe("email preferences actions", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    revalidatePathMock.mockReset();
    vi.resetModules();
  });

  it("creates a missing preferences row during fetch", async () => {
    const state = createState(null);
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { fetchEmailPreferences } = await import("./actions");
    const result = await fetchEmailPreferences();

    expect(result).toMatchObject({
      user_id: "user-1",
      weekly_recap_enabled: true,
      marketing_emails_enabled: true,
    });
    expect(state.row).not.toBeNull();
  });

  it("updates only provided preference fields and revalidates the dashboard", async () => {
    const state = createState({
      user_id: "user-1",
      weekly_recap_enabled: true,
      marketing_emails_enabled: true,
      created_at: "2026-04-17T00:00:00.000Z",
      updated_at: "2026-04-17T00:00:00.000Z",
    });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: createSupabaseStub(state),
    });

    const { updateEmailPreferences } = await import("./actions");
    const result = await updateEmailPreferences({
      marketingEmailsEnabled: false,
    });

    expect(result).toEqual({
      success: true,
      emailPreferences: expect.objectContaining({
        user_id: "user-1",
        weekly_recap_enabled: true,
        marketing_emails_enabled: false,
      }),
    });
    expect(state.updatePayloads).toEqual([{ marketing_emails_enabled: false }]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });
});
