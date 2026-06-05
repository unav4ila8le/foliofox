import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const createServiceClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("deleteAccount", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    createServiceClientMock.mockReset();
    revalidatePathMock.mockReset();
    vi.resetModules();
  });

  it("rejects mismatched email confirmation before using the service client", async () => {
    const signOutMock = vi.fn();
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", email: "person@example.com" },
      supabase: {
        auth: {
          signOut: signOutMock,
        },
      },
    });

    const { deleteAccount } = await import("./delete-account");
    const result = await deleteAccount("other@example.com");

    expect(result).toEqual({
      success: false,
      code: "EMAIL_CONFIRMATION_MISMATCH",
      message: "The email address does not match your account email.",
    });
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("deletes the authenticated auth user after matching email confirmation", async () => {
    const signOutMock = vi.fn();
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", email: "person@example.com" },
      supabase: {
        auth: {
          signOut: signOutMock,
        },
      },
    });
    createServiceClientMock.mockReturnValue({
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
    });

    const { deleteAccount } = await import("./delete-account");
    const result = await deleteAccount(" Person@Example.com ");

    expect(result).toEqual({ success: true });
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("returns the admin delete error when Supabase cannot delete the user", async () => {
    const signOutMock = vi.fn();
    const deleteUserMock = vi.fn().mockResolvedValue({
      error: {
        code: "user_not_found",
        message: "User not found",
      },
    });
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", email: "person@example.com" },
      supabase: {
        auth: {
          signOut: signOutMock,
        },
      },
    });
    createServiceClientMock.mockReturnValue({
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
    });

    const { deleteAccount } = await import("./delete-account");
    const result = await deleteAccount("person@example.com");

    expect(result).toEqual({
      success: false,
      code: "user_not_found",
      message: "User not found",
    });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
