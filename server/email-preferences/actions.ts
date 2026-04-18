"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";
import { ensureEmailPreferencesRow } from "@/server/email-preferences/shared";

import type { EmailPreferences } from "@/types/global.types";

type EmailPreferenceUpdateInput = Partial<
  Pick<EmailPreferences, "weekly_recap_enabled" | "marketing_emails_enabled">
>;

/**
 * Fetch the current user's automated email preferences.
 */
const getCachedEmailPreferences = cache(async () => {
  const { supabase, user } = await getCurrentUser();
  return ensureEmailPreferencesRow({ supabase, userId: user.id });
});

/**
 * Public async wrapper so this module only exports valid Server Actions.
 */
export async function fetchEmailPreferences() {
  return getCachedEmailPreferences();
}

export interface UpdateEmailPreferencesInput {
  weeklyRecapEnabled?: boolean;
  marketingEmailsEnabled?: boolean;
}

/**
 * Update one or more automated email preference flags for the current user.
 */
export async function updateEmailPreferences(
  input: UpdateEmailPreferencesInput,
) {
  const { supabase, user } = await getCurrentUser();

  // 1. Build a minimal update payload so unchanged fields stay untouched.
  const updatePayload: EmailPreferenceUpdateInput = {};

  if (typeof input.weeklyRecapEnabled === "boolean") {
    updatePayload.weekly_recap_enabled = input.weeklyRecapEnabled;
  }

  if (typeof input.marketingEmailsEnabled === "boolean") {
    updatePayload.marketing_emails_enabled = input.marketingEmailsEnabled;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      success: false as const,
      code: "NO_PREFERENCE_UPDATES",
      message: "No automated email preference updates were provided.",
    };
  }

  // 2. Ensure the row exists before applying updates.
  await ensureEmailPreferencesRow({ supabase, userId: user.id });

  // 3. Persist the requested preference changes.
  const { data: updatedPreferences, error: updatePreferencesError } =
    await supabase
      .from("email_preferences")
      .update(updatePayload)
      .eq("user_id", user.id)
      .select("*")
      .single();

  if (updatePreferencesError || !updatedPreferences) {
    return {
      success: false as const,
      code: updatePreferencesError?.code ?? "EMAIL_PREFERENCES_UPDATE_FAILED",
      message:
        updatePreferencesError?.message ||
        "Failed to update automated email preferences.",
    };
  }

  revalidatePath("/dashboard", "layout");

  return {
    success: true as const,
    emailPreferences: updatedPreferences,
  };
}
