"use server";

import {
  AUTOMATED_EMAIL_PREFERENCE_DETAILS,
  type AutomatedEmailPreferenceKey,
} from "@/server/automated-emails/constants";
import { verifyUnsubscribeToken } from "@/server/automated-emails/unsubscribe-token";
import {
  createSingleEmailPreferenceUpdate,
  ensureEmailPreferencesRow,
} from "@/server/email-preferences/shared";
import { createServiceClient } from "@/supabase/service";

export type UnsubscribeEmailPreferenceResult =
  | {
      success: true;
      status: "disabled" | "already_disabled";
      preferenceKey: AutomatedEmailPreferenceKey;
      preferenceLabel: string;
    }
  | {
      success: false;
      status: "invalid_token";
      preferenceKey?: undefined;
      preferenceLabel?: undefined;
    };

/**
 * Disable a single automated email preference from a signed public unsubscribe
 * link without requiring an authenticated session.
 */
export async function unsubscribeFromEmailPreference(
  token: string,
): Promise<UnsubscribeEmailPreferenceResult> {
  const verifiedToken = verifyUnsubscribeToken(token);

  if (!verifiedToken.valid) {
    return {
      success: false,
      status: "invalid_token",
    };
  }

  const supabase = createServiceClient();
  const emailPreferences = await ensureEmailPreferencesRow({
    userId: verifiedToken.payload.userId,
    supabase,
  });
  const preferenceKey = verifiedToken.payload.preferenceKey;
  const preferenceLabel =
    AUTOMATED_EMAIL_PREFERENCE_DETAILS[preferenceKey].label;

  if (emailPreferences[preferenceKey] === false) {
    return {
      success: true,
      status: "already_disabled",
      preferenceKey,
      preferenceLabel,
    };
  }

  const { error } = await supabase
    .from("email_preferences")
    .update(
      createSingleEmailPreferenceUpdate({
        preferenceKey,
        enabled: false,
      }),
    )
    .eq("user_id", verifiedToken.payload.userId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    status: "disabled",
    preferenceKey,
    preferenceLabel,
  };
}
