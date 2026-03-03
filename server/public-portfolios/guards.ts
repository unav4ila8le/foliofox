"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const TIME_ZONE_REQUIRED_ERROR =
  "Set your timezone in Settings before enabling public sharing.";

/**
 * Public-sharing civil-date semantics depend on owner timezone.
 * Block enable/update flows until timezone is explicitly configured.
 */
export async function ensurePublicSharingTimeZoneReady(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("time_zone")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return {
      success: false as const,
      error: error?.message ?? "Unable to verify profile timezone.",
    };
  }

  if (!profile.time_zone || profile.time_zone.trim() === "") {
    return {
      success: false as const,
      error: TIME_ZONE_REQUIRED_ERROR,
    };
  }

  return { success: true as const };
}
