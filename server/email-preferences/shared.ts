import type { SupabaseClient } from "@supabase/supabase-js";

import type { AutomatedEmailPreferenceKey } from "@/server/automated-emails/constants";
import type { Database } from "@/types/database.types";
import type { EmailPreferences } from "@/types/global.types";

type EmailPreferencesClient = SupabaseClient<Database>;

export type EmailPreferencesUpdatePayload = Partial<
  Pick<EmailPreferences, AutomatedEmailPreferenceKey>
>;

export function createSingleEmailPreferenceUpdate(params: {
  preferenceKey: AutomatedEmailPreferenceKey;
  enabled: boolean;
}): EmailPreferencesUpdatePayload {
  const { preferenceKey, enabled } = params;

  return {
    [preferenceKey]: enabled,
  } as EmailPreferencesUpdatePayload;
}

/**
 * Ensure every user has a durable email-preferences row, including legacy
 * accounts that existed before the feature shipped.
 */
export async function ensureEmailPreferencesRow(params: {
  userId: string;
  supabase: EmailPreferencesClient;
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
