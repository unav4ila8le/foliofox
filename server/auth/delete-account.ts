"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { createServiceClient } from "@/supabase/service";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function deleteAccount(confirmationEmail: string) {
  const { supabase, user } = await getCurrentUser();
  const currentEmail = user.email ? normalizeEmail(user.email) : "";
  const confirmedEmail = normalizeEmail(confirmationEmail);

  if (!currentEmail || confirmedEmail !== currentEmail) {
    return {
      success: false as const,
      code: "EMAIL_CONFIRMATION_MISMATCH",
      message: "The email address does not match your account email.",
    };
  }

  const serviceClient = createServiceClient();
  const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(
    user.id,
  );

  if (deleteUserError) {
    return {
      success: false as const,
      code: deleteUserError.code ?? "ACCOUNT_DELETE_FAILED",
      message: deleteUserError.message || "Failed to delete your account.",
    };
  }

  await supabase.auth.signOut({ scope: "local" });

  revalidatePath("/", "layout");
  return { success: true as const };
}
