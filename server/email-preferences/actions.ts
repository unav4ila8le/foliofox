"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/actions";

import type { EmailPreferences } from "@/types/global.types";

type EmailPreferenceUpdatePayload = Partial<
  Pick<EmailPreferences, "weekly_recap_enabled" | "marketing_emails_enabled">
>;

async function ensureEmailPreferencesRow(params: {
  userId: string;
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"];
}) {
  const { userId, supabase } = params;

  // 1. Read the existing row first so regular fetches stay side-effect free.
  const { data: existingPreferences, error: existingPreferencesError } =
    await supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (existingPreferencesError) {
    throw new Error(existingPreferencesError.message);
  }

  if (existingPreferences) {
    return existingPreferences;
  }

  // 2. Self-heal missing rows for legacy or partially migrated environments.
  const { data: insertedPreferences, error: insertPreferencesError } =
    await supabase
      .from("email_preferences")
      .insert({
        user_id: userId,
      })
      .select("*")
      .single();

  if (insertPreferencesError || !insertedPreferences) {
    throw new Error(
      insertPreferencesError?.message ||
        "Failed to create missing email preferences row",
    );
  }

  return insertedPreferences;
}

/**
 * Fetch the current user's automated email preferences.
 */
export const fetchEmailPreferences = cache(async () => {
  const { supabase, user } = await getCurrentUser();
  return ensureEmailPreferencesRow({ supabase, userId: user.id });
});

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
  const updatePayload: EmailPreferenceUpdatePayload = {};

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
