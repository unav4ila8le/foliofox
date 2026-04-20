import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOMATED_EMAIL_PREFERENCE_KEYS } from "@/server/automated-emails/constants";

const verifyUnsubscribeTokenMock = vi.fn();
const createServiceClientMock = vi.fn();
const ensureEmailPreferencesRowMock = vi.fn();

vi.mock("@/server/automated-emails/unsubscribe-token", () => ({
  verifyUnsubscribeToken: verifyUnsubscribeTokenMock,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/server/email-preferences/shared", async () => {
  // Re-export the real createSingleEmailPreferenceUpdate so the test still
  // exercises the real preference-key shape; only ensureEmailPreferencesRow
  // is mocked.
  const actual = await vi.importActual<
    typeof import("@/server/email-preferences/shared")
  >("@/server/email-preferences/shared");
  return {
    ...actual,
    ensureEmailPreferencesRow: ensureEmailPreferencesRowMock,
  };
});

interface FakeUpdateState {
  updatePayloads: Array<Record<string, unknown>>;
  updateUserIdFilters: string[];
  updateError: { message: string } | null;
}

function createFakeServiceClient(state: FakeUpdateState) {
  return {
    from: (table: string) => {
      if (table !== "email_preferences") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      return {
        update(payload: Record<string, unknown>) {
          state.updatePayloads.push(payload);
          return {
            eq(_column: string, value: string) {
              state.updateUserIdFilters.push(value);
              return Promise.resolve({ error: state.updateError });
            },
          };
        },
      };
    },
  };
}

function createUpdateState(): FakeUpdateState {
  return {
    updatePayloads: [],
    updateUserIdFilters: [],
    updateError: null,
  };
}

describe("unsubscribeFromEmailPreference", () => {
  beforeEach(() => {
    verifyUnsubscribeTokenMock.mockReset();
    createServiceClientMock.mockReset();
    ensureEmailPreferencesRowMock.mockReset();
    vi.resetModules();
  });

  it("returns invalid_token when the signed token cannot be verified", async () => {
    verifyUnsubscribeTokenMock.mockReturnValue({
      valid: false,
      reason: "invalid_signature",
    });

    const { unsubscribeFromEmailPreference } = await import("./unsubscribe");
    const result = await unsubscribeFromEmailPreference("bad-token");

    expect(result).toEqual({
      success: false,
      status: "invalid_token",
    });
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(ensureEmailPreferencesRowMock).not.toHaveBeenCalled();
  });

  it("returns already_disabled without writing when the preference is off", async () => {
    verifyUnsubscribeTokenMock.mockReturnValue({
      valid: true,
      payload: {
        userId: "user-1",
        preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
        expiresAt: "2026-12-31T00:00:00.000Z",
        version: 1,
      },
    });

    const updateState = createUpdateState();
    createServiceClientMock.mockReturnValue(
      createFakeServiceClient(updateState),
    );
    ensureEmailPreferencesRowMock.mockResolvedValue({
      user_id: "user-1",
      weekly_recap_enabled: false,
      marketing_emails_enabled: true,
    });

    const { unsubscribeFromEmailPreference } = await import("./unsubscribe");
    const result = await unsubscribeFromEmailPreference("good-token");

    expect(result).toEqual({
      success: true,
      status: "already_disabled",
      preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
      preferenceLabel: "Weekly recap",
    });
    expect(updateState.updatePayloads).toEqual([]);
  });

  it("disables the targeted preference when it is currently enabled", async () => {
    verifyUnsubscribeTokenMock.mockReturnValue({
      valid: true,
      payload: {
        userId: "user-2",
        preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS,
        expiresAt: "2026-12-31T00:00:00.000Z",
        version: 1,
      },
    });

    const updateState = createUpdateState();
    createServiceClientMock.mockReturnValue(
      createFakeServiceClient(updateState),
    );
    ensureEmailPreferencesRowMock.mockResolvedValue({
      user_id: "user-2",
      weekly_recap_enabled: true,
      marketing_emails_enabled: true,
    });

    const { unsubscribeFromEmailPreference } = await import("./unsubscribe");
    const result = await unsubscribeFromEmailPreference("good-token");

    expect(result).toEqual({
      success: true,
      status: "disabled",
      preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.MARKETING_EMAILS,
      preferenceLabel: "Marketing emails",
    });
    expect(updateState.updatePayloads).toEqual([
      { marketing_emails_enabled: false },
    ]);
    expect(updateState.updateUserIdFilters).toEqual(["user-2"]);
  });

  it("propagates Supabase update errors as thrown exceptions", async () => {
    verifyUnsubscribeTokenMock.mockReturnValue({
      valid: true,
      payload: {
        userId: "user-3",
        preferenceKey: AUTOMATED_EMAIL_PREFERENCE_KEYS.WEEKLY_RECAP,
        expiresAt: "2026-12-31T00:00:00.000Z",
        version: 1,
      },
    });

    const updateState = createUpdateState();
    updateState.updateError = { message: "row level security violated" };
    createServiceClientMock.mockReturnValue(
      createFakeServiceClient(updateState),
    );
    ensureEmailPreferencesRowMock.mockResolvedValue({
      user_id: "user-3",
      weekly_recap_enabled: true,
      marketing_emails_enabled: true,
    });

    const { unsubscribeFromEmailPreference } = await import("./unsubscribe");

    await expect(unsubscribeFromEmailPreference("good-token")).rejects.toThrow(
      "row level security violated",
    );
  });
});
